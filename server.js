const express = require("express");
const cors = require("cors");
const axios = require("axios");
const wiki = require("wikipedia");
const NewsAPI = require("newsapi");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const winston = require("winston");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const FormData = require("form-data");
const { GoogleGenAI } = require("@google/genai");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const { Resend } = require("resend");

require("dotenv").config();



const User = require("./models/User");
const OTP = mongoose.model(
  "OTP",

  new mongoose.Schema({

    email: String,

    otp: String,

    attempts: {
      type: Number,
      default: 0
    },

    expireAt: {
      type: Date,
      default: () => Date.now() + 5 * 60 * 1000,
      index: {
        expires: 0
      }
    }

  })
);

const app = express();

app.set("trust proxy", 1);


const otpLimiter = rateLimit({

  windowMs: 60 * 1000, // 1 minute

  max: 3, // 3 OTP requests

  message: {
    error: "Too many OTP requests. Try again after 1 minute."
  },

  standardHeaders: true,

  legacyHeaders: false,

});


const upload = multer({
  dest: "uploads/"
});


let currentPdfText = "";
let chatHistory = [];

// ================= CONFIG =================
const JWT_SECRET = process.env.JWT_SECRET || "vedaai_secret_key";
const API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: API_KEY,
});
const newsapi = new NewsAPI(process.env.NEWS_API_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

console.log("========= SERVER TEST =========");
console.log("KEY PREFIX:", API_KEY ? API_KEY.substring(0, 6) : "NONE");

(async () => {
  try {

    const r = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Hello",
    });

    console.log("SERVER SDK WORKING");
    console.log(r.text);

  } catch (e) {

    console.log("SERVER SDK FAILED");
    console.log(e);

  }
})();

// ================= RAZORPAY =================

const razorpay = new Razorpay({

  key_id: process.env.RAZORPAY_KEY_ID,

  key_secret: process.env.RAZORPAY_KEY_SECRET,

});

// ================= CHECK API =================
if (!API_KEY) {
  console.error("❌ GEMINI API KEY NOT FOUND");
  process.exit(1);
}

console.log("✅ API KEY LOADED");

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());
app.use(helmet());

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 20
}));

// ================= LOGGER =================
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "logs.log" })
  ]
});

// ================= DB =================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ MongoDB Error:", err));

// ================= MEMORY =================
const MemorySchema = new mongoose.Schema({

  userId: String,

  profile: {
    name: String
  },

  // NORMAL CHAT
  chats: [
    {
      role: String,
      text: String
    }
  ],

  // PINNED MESSAGES
  pins: [
    {
      role: String,
      text: String
    }
  ],

  // APP SETTINGS
  settings: {
    theme: {
      type: String,
      default: "light"
    },

    language: {
      type: String,
      default: "English"
    }
  },

  // PDFS
  pdfs: [

    {

      name: String,

      pdfUri: String,

      pdfMimeType: String,

      uploadedAt: {
        type: Date,
        default: Date.now
      },

      messages: [

        {

          role: String,

          text: String

        }

      ]

    }

  ]

}, { timestamps: true });

const Memory = mongoose.model("Memory", MemorySchema);

// ================= AUTH MIDDLEWARE =================
function auth(req, res, next) {

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "No token provided"
    });
  }

  const token = authHeader.split(" ")[1];

  try {

    const decoded = jwt.verify(token, JWT_SECRET);

    req.userId = decoded.userId;

    next();

  } catch (err) {

    return res.status(401).json({
      error: "Invalid token"
    });

  }

}
// ================= SEND OTP =================

app.post("/send-otp", otpLimiter, async (req, res) => {

  try {

    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    const otp = Math.floor(
  100000 + Math.random() * 900000
).toString();

await OTP.deleteMany({ email });

await OTP.create({
  email,
  otp
});

console.log("STEP 1 - User Found");


await resend.emails.send({
  from: "VedaAI <onboarding@resend.dev>",
  to: email,
  subject: "VedaAI Password Reset OTP",
  html: `
    <h2>VedaAI</h2>
    <p>Your OTP is:</p>
    <h1>${otp}</h1>
    <p>This OTP is valid for 5 minutes.</p>
  `,
});

console.log("STEP 2 - Email Sent");

return res.json({
  message: "OTP Sent Successfully"
});

  } catch (err) {

    console.log(err);

    return res.status(500).json({
      error: err.message
    });

  }

});

// ================= VERIFY OTP =================

app.post("/verify-otp", async (req, res) => {

  try {

    const { email, otp } = req.body;


    const record = await OTP.findOne({
      email
    });


    if (!record) {

      return res.status(400).json({
        error: "OTP expired or not found"
      });

    }


    // Expiry check
    if (Date.now() > record.expireAt.getTime()) {

      await OTP.deleteOne({
        _id: record._id
      });

      return res.status(400).json({
        error: "OTP expired"
      });

    }


    // Attempts check
    if (record.attempts >= 5) {

      await OTP.deleteOne({
        _id: record._id
      });

      return res.status(429).json({
        error: "Too many wrong attempts. Request new OTP."
      });

    }


    // Wrong OTP
    if (record.otp !== otp) {


      record.attempts += 1;

      await record.save();


      return res.status(400).json({

        error:
        `Invalid OTP. Attempts left: ${5 - record.attempts}`

      });

    }


    // Correct OTP

    await OTP.deleteOne({
      _id: record._id
    });


    return res.json({

      message:"OTP Verified Successfully"

    });


  } catch(err) {


    console.log(err);


    return res.status(500).json({

      error:err.message

    });


  }

});

// ================= RESET PASSWORD =================

app.post("/reset-password", async (req, res) => {

  try {

    const { email, password } = req.body;

    const hash = await bcrypt.hash(password, 10);

    await User.updateOne(

      { email },

      {

        $set: {

          password: hash

        }

      }

    );

    await OTP.deleteMany({

      email

    });

    return res.json({

      message: "Password Reset Successfully"

    });

  } catch (err) {

    return res.status(500).json({

      error: err.message

    });

  }

});
// ================= SIGNUP =================
app.post("/signup", async (req, res) => {

  try {

    const { name, email, password } = req.body;


    const exist = await User.findOne({
      email
    });


    if (exist) {

      return res.status(400).json({
        error: "User already exists"
      });

    }

const hash = await bcrypt.hash(
  password,
  10
);

// Default User
let role = "user";
let isPremium = false;
let subscriptionType = "free";
let subscriptionExpiry = null;

// Owner Account
if (email.toLowerCase() === "yashya2522@gmail.com") {

  role = "owner";
  isPremium = true;
  subscriptionType = "lifetime";

}

const user = await User.create({

  name,
  email,
  password: hash,

  role,
  isPremium,
  subscriptionType,
  subscriptionExpiry

});
    

    const token = jwt.sign(

      {
        userId: user._id
      },

      JWT_SECRET,

      {
        expiresIn:"7d"
      }

    );


   res.json({

  message: "Signup successful",

  token,

  userId: user._id,

  name: user.name,              // ✅ ADD

  role: user.role,              // ✅ ADD

  isPremium: user.isPremium,    // ✅ ADD

  subscriptionType: user.subscriptionType, // ✅ ADD

  subscriptionExpiry: user.subscriptionExpiry // ✅ ADD

});

  } catch(err) {

    res.status(500).json({

      error:err.message

    });

  }

});
// ================= LOGIN =================
app.post("/login", async (req, res) => {
  try {

    

    
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (
  user &&
  user.isPremium &&
  user.subscriptionExpiry &&
  new Date() > user.subscriptionExpiry
) {

  user.isPremium = false;
  user.subscriptionType = "free";
  user.subscriptionExpiry = null;

  await user.save();

}

    
    if (!user) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    const match = await bcrypt.compare(
      password,
      user.password
    );

    if (!match) {
      return res.status(401).json({
 error:"Invalid email or password"
});
    }

    const token = jwt.sign(
  { 
    userId: user._id,
    email: user.email,
    role: user.role
  },
  process.env.JWT_SECRET,
  { 
    expiresIn: "7d" 
  }
);
return res.json({

  message: "Login successful",

  token,

  userId: user._id,

  name: user.name,   // ✅ ADD THIS

  role: user.role,

  isPremium: user.isPremium,

  subscriptionType: user.subscriptionType,

  subscriptionExpiry: user.subscriptionExpiry

});
  } catch (err) {

    return res.status(500).json({
      error: err.message
    });

  }
});

// ================= JWT AUTH MIDDLEWARE =================

const authMiddleware = (req,res,next)=>{

  try{

    const authHeader = req.headers.authorization;


    if(!authHeader){
      return res.status(401).json({
        error:"No token provided"
      });
    }


    const token = authHeader.split(" ")[1];


    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );


    req.user = decoded;


    next();


  }catch(err){

    return res.status(401).json({
      error:"Invalid or expired token"
    });

  }

};

 app.post("/activate-premium", async (req, res) => {

  try {

    const {
      userId,
      plan
    } = req.body;


    const user = await User.findById(userId);


    if(!user){

      return res.status(404).json({
        error:"User not found"
      });

    }
   if (user.role === "owner") {

  return res.json({

    message: "Owner already has lifetime premium",

    isPremium: true,

    subscriptionType: "lifetime"

  });

}

    user.isPremium = true;

    user.subscriptionType = plan;


    if(plan === "monthly"){

      user.subscriptionExpiry =
        new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        );

    }


    if(plan === "yearly"){

      user.subscriptionExpiry =
        new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000
        );

    }


    await user.save();


    res.json({

      message:"Premium activated",

      plan:user.subscriptionType,

      expiry:user.subscriptionExpiry

    });


  } catch(err){

    res.status(500).json({

      error:err.message

    });

  }

});

// ================= WIKIPEDIA =================
async function searchWikipedia(query) {
  try {
    const page = await wiki.page(query);
    const summary = await page.summary();
    return summary?.extract?.slice(0, 1000) || "";
  } catch {
    return "";
  }
}

// ================= NEWS =================
async function getNews(query) {
  try {
    const response = await newsapi.v2.everything({
      q: query,
      language: "en",
      pageSize: 3
    });

    return response.articles.map(a =>
      `${a.title}\n${a.description}`
    ).join("\n\n");

  } catch {
    return "";
  }
}
// ================= IMAGE UPLOAD =================
app.post("/image", auth, upload.single("image"), async(req,res)=>{

try {
   
  const user = await User.findById(req.userId);

if (!user) {
  return res.status(404).json({
    error: "User not found"
  });
}


// FREE USER IMAGE LIMIT
if (!user.isPremium) {

  const today = new Date();
  const lastReset = new Date(user.lastLimitReset);


  // Daily reset
  if (
    today.toDateString() !==
    lastReset.toDateString()
  ) {

    user.messageCount = 0;
    user.pdfCount = 0;
    user.imageCount = 0;
    user.lastLimitReset = today;

    await user.save();

  }


  // 5 Image limit
  if (user.imageCount >= 5) {

    return res.json({
      success: false,
      message:
      "Daily free image limit completed. Upgrade to Premium 👑"
    });

  }

}

console.log("IMAGE RECEIVED:");
console.log(req.file);


if(!req.file){
 return res.status(400).json({
  error:"No image uploaded"
 });
}


const imageBuffer = fs.readFileSync(req.file.path);

const imageBase64 = imageBuffer.toString("base64");
await Memory.findOneAndUpdate(
  {
    userId: req.userId
  },
  {
    imageMimeType: req.file.mimetype,
    imageName: req.file.originalname
  },
  {
    upsert:true
  }
);

console.log("Image saved in memory");

const response = await axios.post(

`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,

{
contents:[
{
parts:[

{
text:`
You are VedaAI.

Analyze this image carefully.

1. Describe the image.
2. Extract any text present.
3. Explain important details.
4. Reply in user's language.
`
},

{
inline_data:{
mime_type:req.file.mimetype,
data:imageBase64
}
}

]
}
]
}

);


if(fs.existsSync(req.file.path)){
 fs.unlinkSync(req.file.path);
}


const aiText =
response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
"No response from AI";


if (!user.isPremium) {

  user.imageCount += 1;

  await user.save();

}


res.json({
  reply: aiText
});


}
catch(err){

console.log("IMAGE ERROR:");
console.log(err.message);

res.status(500).json({
error:"Image upload failed",
details:err.message
});

}

});

app.post("/pdf", auth, upload.single("pdf"), async (req,res)=>{
  try {
    
    const user = await User.findById(req.userId);

if (!user) {
  return res.status(404).json({
    error: "User not found"
  });
}


// FREE USER PDF LIMIT
if (!user.isPremium) {

  const today = new Date();
  const lastReset = new Date(user.lastLimitReset);


  // Daily reset
  if (
    today.toDateString() !==
    lastReset.toDateString()
  ) {

    user.messageCount = 0;
    user.pdfCount = 0;
    user.imageCount = 0;
    user.lastLimitReset = today;

    await user.save();

  }


  // 5 PDF limit
  if (user.pdfCount >= 5) {

    return res.json({
      success: false,
      message:
      "Daily free PDF limit completed. Upgrade to Premium 👑"
    });

  }

}

    if (!req.file) {
      return res.status(400).json({
        error: "No PDF uploaded"
      });
    }


    console.log("PDF RECEIVED:");
    console.log(req.file.originalname);


   const uploadedFile = await ai.files.upload({

  file: req.file.path,

  config: {
    mimeType: "application/pdf",
  },

});


console.log("UPLOADED FILE OBJECT:");
console.log(JSON.stringify(uploadedFile, null, 2));


const fileInfo = await ai.files.get({
  name: uploadedFile.name
});

console.log("FILE STATE:", fileInfo.state);

console.log("UPLOADED FILE OBJECT:");
console.log(JSON.stringify(uploadedFile, null, 2));

console.log("NAME:", uploadedFile.name);
console.log("URI:", uploadedFile.uri);
console.log("MIME:", uploadedFile.mimeType);


await Memory.findOneAndUpdate(
  {
    userId: req.userId
  },
  {
    $push: {
      pdfs: {
        name: req.file.originalname,
        pdfUri: uploadedFile.uri,
        pdfMimeType: uploadedFile.mimeType
      }
    }
  },
  {
    upsert: true
  }
);

console.log("PDF added successfully");

if (!user.isPremium) {

  user.pdfCount += 1;

  await user.save();

}

    const result = await ai.models.generateContent({

     model: "gemini-2.5-flash",

      contents: [

        {
          role: "user",

          parts: [

            {
              fileData: {
    fileUri: uploadedFile.uri,
    mimeType: uploadedFile.mimeType || "application/pdf"

              },

            },


            {
              text: `
You are VedaAI.

IMPORTANT LANGUAGE RULE:
Always answer in English.
Do not follow the language of the PDF.

Analyze this PDF carefully.

Give response in structured format:

1. PDF Type
2. Summary
3. Important Points
4. Detailed Explanation
5. Important Questions
6. Suggestions
`

            }

          ],

        }

      ],

    });

   await Memory.findOneAndUpdate(
{
 userId: req.userId
},
{
 $push:{
   messages:{
     role:"assistant",
     text: result.text
   }
 }
}
);
console.log("✅ PDF + AI response saved");

    if (fs.existsSync(req.file.path)) {

      fs.unlinkSync(req.file.path);

    }



    return res.json({

      reply: result.text || "No response generated",

      fileUri: uploadedFile.uri

    });



  } catch (err) {


    console.log("PDF ERROR:");

    console.log(err.message);


    return res.status(500).json({

      error: "PDF upload failed",

      details: err.message

    });


  }

});

console.log("✅ PDF CHAT ROUTE LOADED");
app.post("/pdf-chat", auth, async(req,res)=>{

  try {
const { pdfId, message } = req.body;

if (!pdfId || !message) {
  return res.status(400).json({
    error: "pdfId and message required"
  });
}


   const memory = await Memory.findOne({
  userId: req.userId
});

if (!memory) {
  return res.status(400).json({
    error: "No PDFs found"
  });
}

const pdf = memory.pdfs.id(pdfId);

if (!pdf) {
  return res.status(404).json({
    error: "PDF not found"
  });
}

    const result = await ai.models.generateContent({

 model: "gemini-2.5-flash",

  contents: [
    {
      role:"user",
      parts:[
        {
          fileData:{
            fileUri: pdf.pdfUri,
            mimeType: pdf.pdfMimeType || "application/pdf"
          }
        },
        {
          text: message
        }
      ]
    }
  ]

});

// SAVE USER MESSAGE
await Memory.findOneAndUpdate(
  {
    userId: req.userId,
    "pdfs._id": pdfId
  },
  {
    $push: {
      "pdfs.$.messages": {
        role: "user",
        text: message
      }
    }
  }
);

// SAVE AI MESSAGE
await Memory.findOneAndUpdate(
  {
    userId: req.userId,
    "pdfs._id": pdfId
  },
  {
    $push: {
      "pdfs.$.messages": {
        role: "assistant",
        text: result.text
      }
    }
  }
);

console.log("PDF CHAT HISTORY SAVED");



return res.json({
 reply: result.text
});
    
  } catch(err) {

    console.log("PDF HISTORY ERROR:");
    console.log(err.message);

    return res.status(500).json({
      error:"Failed to load history"
    });

  }

});

 console.log("PDF HISTORY ROUTE REGISTERED");

app.get("/pdf-history/:pdfId", auth, async (req, res) => {

  try {

    const memory = await Memory.findOne({
      userId: req.userId
    });

    if (!memory) {
      return res.status(404).json({
        error: "Memory not found"
      });
    }

    const pdf = memory.pdfs.id(req.params.pdfId);

    if (!pdf) {
      return res.status(404).json({
        error: "PDF not found"
      });
    }

    return res.json({
      history: pdf.messages
    });

  } catch (err) {

    return res.status(500).json({
      error: err.message
    });

  }

});

console.log("✅ MY PDFS ROUTE REGISTERED");
app.get("/my-pdfs", auth, async (req, res) => {

  try {

    const memory = await Memory.findOne({
  userId: req.userId
});

console.log("MEMORY =", JSON.stringify(memory, null, 2));

return res.json({
  pdfs: memory?.pdfs || []
});

  } catch (err) {

    return res.status(500).json({
      error: err.message
    });

  }

});

console.log("✅ SYNC ROUTE REGISTERED");

app.get("/sync", auth, async (req, res) => {

  try {

    const memory = await Memory.findOne({
      userId: req.userId
    });

    if (!memory) {
      return res.json({
        profile: {},
        chats: [],
        pins: [],
        settings: {},
        pdfs: []
      });
    }

    return res.json({

      profile: memory.profile || {},

      chats: memory.chats || [],

      pins: memory.pins || [],

      settings: memory.settings || {},

      pdfs: memory.pdfs || []

    });

  } catch (err) {

    return res.status(500).json({
      error: err.message
    });

  }

});

app.get("/make-owner", async (req, res) => {
  try {

    const user = await User.findOneAndUpdate(

      {
        email: "yashya2522@gmail.com"
      },

      {
        role: "owner",
        isPremium: true,
        subscriptionType: "lifetime",
        subscriptionExpiry: null
      },

      {
        new: true
      }

    );

    if (!user) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    res.json({
      message: "Owner Updated Successfully",
      user
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }
});
// ================= CHAT =================
app.post("/chat", auth, async (req, res) => {
  try {

    const userMessage = req.body.message;
    const userId = req.userId || "guest";

    if (!userMessage) {
      return res.status(400).json({ error: "Message required" });
    }
     
    let user = null;

if (userId !== "guest") {

  user = await User.findById(userId);

  if (
    user &&
    !user.isPremium
  ) {

    const today = new Date();
    const lastReset = new Date(user.lastLimitReset);


    // Daily reset
    if (
      today.toDateString() !==
      lastReset.toDateString()
    ) {

      user.messageCount = 0;
      user.pdfCount = 0;
      user.imageCount = 0;
      user.lastLimitReset = today;

      await user.save();

    }


    // 100 messages limit
    if (user.messageCount >= 100) {

      return res.json({
        success: false,
        message:
        "Daily free message limit completed. Upgrade to Premium 👑"
      });

    }
           user.messageCount += 1;

            await user.save();
  }

}
  

// ================= MEMORY =================
let memory = await Memory.findOne({ userId });

if (!memory) {

  memory = new Memory({
    userId,
    chats: []
  });

}

// Safety for old documents
if (!Array.isArray(memory.chats)) {
  memory.chats = [];
}

// Save user message
memory.chats.push({
  role: "user",
  text: userMessage
});

await memory.save();

// ================= AI INPUT =================
const wikiText = await searchWikipedia(userMessage);
const newsText = await getNews(userMessage);

// Last 10 chats
const history = memory.chats
  .slice(-10)
  .map(m => `${m.role}: ${m.text}`)
  .join("\n");
    

const SYSTEM_PROMPT = `
You are VedaAI, an advanced AI assistant similar to ChatGPT.

IDENTITY
- You are intelligent, professional, friendly and highly knowledgeable.
- Your mission is to provide the most accurate, detailed and useful answer possible.

KNOWLEDGE DOMAINS
You can answer questions from ANY field including but not limited to:

• General Knowledge
• Current Affairs
• Indian Affairs
• International Affairs
• World History
• Indian History
• Ancient History
• Medieval History
• Modern History
• Geography
• Politics
• Economics
• Business
• Finance
• Banking
• Stock Market
• Cryptocurrency
• Science
• Physics
• Chemistry
• Biology
• Mathematics
• Statistics
• Artificial Intelligence
• Machine Learning
• Deep Learning
• Data Science
• Cybersecurity
• Programming
• Flutter
• Android Development
• Web Development
• Databases
• Networking
• Operating Systems
• Cloud Computing
• Education
• School Subjects
• College Subjects
• Competitive Exams
• UPSC
• MPSC
• JEE
• NEET
• Literature
• Philosophy
• Psychology
• Health
• Medicine
• Sports
• Movies
• Music
• Food
• Recipes
• Travel
• Astronomy
• Space Science
• Law
• Religion
• Culture
• Biographies
• Languages
• Translation
• Casual Conversation
• Jokes
• Any other topic

LANGUAGE RULES
- Always reply in the same language as the user.
- Only switch languages if explicitly requested.
- Never unnecessarily mix languages.

FORMAT RULES
- Use Markdown formatting.
- Use headings when useful.
- Use bullet points and numbered lists.
- Use tables when useful.
- Use examples whenever they improve understanding.
- Explain difficult concepts step by step.

REASONING RULES
- Think carefully before answering.
- Prefer factual accuracy over confidence.
- Distinguish facts, assumptions and opinions.
- Never invent dates, events, statistics or references.
- If information may have changed recently, clearly mention that newer information may exist.
- If uncertain, say exactly:
"I don't know."

MEMORY RULES
- The conversation history is extremely important.
- Always use information from History when answering.

CODING RULES
- Generate clean, working and well-commented code.
- Debug errors step-by-step.
- Explain code in simple language.

BEHAVIOR
- Stay helpful, respectful and neutral.
- Avoid unnecessary refusals.
- Provide the best possible answer with available knowledge.
`;

let pdfInstruction = "";

if (memory.pdfUri) {
  pdfInstruction = `
The user has already uploaded a PDF.

Whenever the user's question is related to that PDF,
answer using the uploaded PDF.

PDF URI:
${memory.pdfUri}
`;
} 

const finalPrompt = `
${SYSTEM_PROMPT}

Wikipedia:
${wikiText}

News:
${newsText}

History:
${history}
${pdfInstruction}

User:
${userMessage}

Assistant:
`;


// ================= GEMINI =================

async function callGemini(finalPrompt) {

  try {

    const response = await ai.models.generateContent({
     model: "gemini-2.5-flash",
      contents: finalPrompt,
    });

    return response;

  } catch (err) {

    console.log("GEMINI SDK ERROR:");
    console.log(err);

    throw err;

  }

}
// ================= CALL GEMINI =================
const response = await callGemini(finalPrompt);

console.log("========== GEMINI DEBUG ==========");
console.log("API KEY EXISTS:", !!API_KEY);
console.log("API KEY LENGTH:", API_KEY ? API_KEY.length : 0);
console.log("API KEY PREFIX:", API_KEY ? API_KEY.substring(0, 6) : "NONE");
console.log("=================================");

// ================= AI RESPONSE =================

let aiText = response.text;

if (!aiText || aiText.trim() === "") {
  aiText = "No response from AI";
}

// ================= SAVE CHAT =================

memory.chats.push({
  role: "assistant",
  text: aiText
});

await memory.save();

// ================= FREE LIMIT =================

if (user && !user.isPremium) {

  user.messageCount += 1;

  await user.save();

}

// ================= RESPONSE =================

return res.json({
  success: true,
  reply: aiText
});

} catch (err) {

  console.log("========== GEMINI ERROR ==========");
  console.log(err);

   if(
    err.message.includes("429") ||
    err.message.includes("RESOURCE_EXHAUSTED")
  ){

    return res.json({

      success: false,

      message:
      "AI is temporarily busy. Please try again later."

    });

  }

  return res.status(500).json({
    error: "Server Error",
    details: err.message
  });

}

});
    
  

app.post("/create-order", async (req, res) => {

  try {

    const { plan } = req.body;

let amount = 19900;
let receipt = "vedaai_monthly_plan";

if (plan === "yearly") {
  amount = 149900;
  receipt = "vedaai_yearly_plan";
}

const options = {
  amount: amount,
  currency: "INR",
  receipt: receipt,
};


    const order =
      await razorpay.orders.create(options);


    res.json({
      success: true,
      order,
    });


  } catch (error) {

    console.log(error);

    res.status(500).json({
      error: "Order creation failed",
    });

  }

});

app.post("/verify-payment", async (req, res) => {

  try {

    const {
  userId,
  plan,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature
} = req.body;


    const body =
      razorpay_order_id +
      "|" +
      razorpay_payment_id;


    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          process.env.RAZORPAY_KEY_SECRET
        )
        .update(body.toString())
        .digest("hex");


    if (expectedSignature === razorpay_signature) {


  


  const user = await User.findById(userId);

if (!user) {

  return res.status(404).json({
    success: false,
    message: "User not found"
  });

}


user.isPremium = true;

user.subscriptionType = plan || "monthly";


if (plan === "yearly") {

  user.subscriptionExpiry = new Date(
    Date.now() + 365 * 24 * 60 * 60 * 1000
  );

} else {

  user.subscriptionExpiry = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  );

}

  await user.save();


  res.json({
  success: true,
  message: "Payment verified and Premium activated",

  isPremium: user.isPremium,

  subscriptionType: user.subscriptionType,

  subscriptionExpiry: user.subscriptionExpiry
});

}else {

      res.status(400).json({
        success: false,
        message: "Invalid signature"
      });

    }


  } catch(error) {

    console.log(error);

    res.status(500).json({
      error: "Verification failed"
    });

  }

});

// ================= HOME =================
app.get("/", (req, res) => {
  res.send("🔥 VedaAI backend running");
});

// ================= SERVER =================
const PORT = process.env.PORT || 3000;
console.log("BEFORE LISTEN");
app.listen(PORT, () => {
  console.log(`🔥 VedaAI running on port ${PORT}`);
});