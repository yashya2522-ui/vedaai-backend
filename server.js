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


// ================= SHOULD SEARCH WEB =================
function shouldSearchWeb(query) {

  const q = query.toLowerCase().trim();

  const keywords = [

    // Current information
    "today",
    "latest",
    "current",
    "now",
    "news",
    "breaking",
    "live",

    // Sports
    "ipl",
    "winner",
    "score",
    "match",
    "result",

    // Government / Politics
    "minister",
    "prime minister",
    "president",
    "chief minister",
    "election",

    // Market
    "gold price",
    "silver price",
    "stock",
    "share price",
    "bitcoin",
    "crypto",

    // Weather
    "weather",
    "temperature",
    "rain",

    // Years
    "2025",
    "2026",
    "2027"

  ];

  return keywords.some(k => q.includes(k));

}

// ================= WEB CACHE =================
const webCache = new Map();
const CACHE_TIME = 10 * 60 * 1000; // 10 minutes

// ================= WEB SEARCH =================

async function searchWeb(query) {
  try {

    const searchStart = Date.now();

    const key = query.trim().toLowerCase();

    const cached = webCache.get(key);

    if (cached && Date.now() - cached.time < CACHE_TIME) {

      console.log("CACHE HIT");

      console.log(
        `TAVILY TIME: ${Date.now() - searchStart} ms (CACHE)`
      );

      return cached.results;

    }

    console.log("CACHE MISS");

    const response = await axios.post(
      "https://api.tavily.com/search",
      {
        api_key: process.env.TAVILY_API_KEY,
        query: query.substring(0, 400),
        search_depth: "advanced",
        max_results: 5,
      }
    );

    const results = response.data.results || [];

    webCache.set(key, {
      results,
      time: Date.now(),
    });

    console.log(
      `TAVILY TIME: ${Date.now() - searchStart} ms`
    );

    return results;

  } catch (err) {
    console.log("TAVILY ERROR:", err.response?.data || err.message);
    return [];
  }
}

function isGreeting(message) {

  const text = message.toLowerCase().trim();

  const greetings = [
    "hi",
    "hello",
    "hey",
    "hii",
    "namaste",
    "नमस्कार",
    "हॅलो"
  ];

  return greetings.some(greet => text.startsWith(greet));

}

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


// ================= CHECK API =================
if (!API_KEY) {
  console.error("❌ GEMINI API KEY NOT FOUND");
  process.exit(1);
}

console.log("✅ API KEY LOADED");

const razorpay = new Razorpay({

  key_id: process.env.RAZORPAY_KEY_ID,

  key_secret: process.env.RAZORPAY_KEY_SECRET,

});
// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());
app.use(helmet());

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 20
}));

function checkSubscription(user) {

  // Guest
  if (!user) {
    return {
      premium: false,
      plan: "free"
    };
  }

  // Owner
  if (user.role === "owner") {
    return {
      premium: true,
      plan: "lifetime"
    };
  }

  // Expiry check
  if (user.isPremium) {

    // जर expiry नाही तर invalid premium
    if (!user.subscriptionExpiry) {
      return {
        premium: false,
        plan: "free"
      };
    }

    // Premium चालू आहे
    if (new Date() < new Date(user.subscriptionExpiry)) {
      return {
        premium: true,
        plan: user.subscriptionType
      };
    }

    // Premium संपलं
    user.isPremium = false;
    user.subscriptionType = "free";
    user.subscriptionExpiry = null;

    // Database save वेगळ्या API मध्ये करू
    return {
      premium: false,
      plan: "free",
      expired: true
    };

  }

  // Free
  return {
    premium: false,
    plan: "free"
  };

}

// ================= PLAN LIMITS =================

function getPlanLimits(user){

  if(!user){

    return{
      chat:100,
      image:5,
      pdf:3
    };

  }

  if(user.role === "owner"){

    return{

      chat:Infinity,
      image:Infinity,
      pdf:Infinity

    };

  }

  const subscription = checkSubscription(user);

  if(!subscription.premium){

    return{

      chat:100,
      image:5,
      pdf:3

    };

  }

  if(subscription.plan === "monthly"){

    return{

      chat:1000,
      image:300,
      pdf:150

    };

  }

  if(subscription.plan === "yearly"){

    return{

      chat:1000,
      image:300,
      pdf:150

    };

  }

  return{

    chat:100,
    image:5,
    pdf:3

  };

}

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
  // CHAT SESSIONS
chatSessions: [
  {
    title: String,

    favorite: {
      type: Boolean,
      default: false,
    },

    messages: [
      {
        role: String,
        text: String,
      }
    ]
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

  name: user.name,

  role: user.role,

  isPremium: user.isPremium,

  subscriptionType: user.subscriptionType,

  subscriptionExpiry: user.subscriptionExpiry

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

  name: user.name,

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

app.get("/load-chats", auth, async (req, res) => {
  try {

    const memory = await Memory.findOne({
      userId: req.userId,
    });

    if (!memory) {
      return res.json({
        chats: [],
      });
    }

    return res.json({
      chats: memory.chatSessions || [],
    });

  } catch (err) {

    return res.status(500).json({
      error: err.message,
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


const subscription = checkSubscription(user);

const limits = getPlanLimits(user);

if (subscription.expired) {

  await user.save();

}

const today = new Date();

const lastReset = new Date(
  user.dailyUsage.lastReset
);

if (
  today.toDateString() !==
  lastReset.toDateString()
) {

  user.dailyUsage.chat = 0;
  user.dailyUsage.pdf = 0;
  user.dailyUsage.image = 0;

  user.dailyUsage.lastReset = today;

  await user.save();

}

if (
  user.dailyUsage.image >= limits.image
) {

  return res.json({

    success: false,

    message:
      "Daily Image Limit Completed. Upgrade to Premium 👑"

  });

}

user.dailyUsage.image++;

await user.save();

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

app.post("/pdf", auth, upload.single("file"), async (req,res)=>{
  try {
    
    const user = await User.findById(req.userId);

if (!user) {
  return res.status(404).json({
    error: "User not found"
  });
}


// FREE USER PDF LIMIT

 const subscription = checkSubscription(user);

const limits = getPlanLimits(user);

console.log("========== PDF DEBUG ==========");
console.log("User Premium:", user.isPremium);
console.log("Premium Expiry:", user.premiumExpiry);
console.log("PDF Used:", user.dailyUsage.pdf);
console.log("PDF Limit:", limits.pdf);
console.log("Subscription:", subscription);
console.log("==============================");

if (subscription.expired) {
  await user.save();
}

const today = new Date();

const lastReset = new Date(user.dailyUsage.lastReset);

if (today.toDateString() != lastReset.toDateString()) {

  user.dailyUsage.chat = 0;
  user.dailyUsage.pdf = 0;
  user.dailyUsage.image = 0;

  user.dailyUsage.lastReset = today;

  await user.save();

}

if (user.dailyUsage.pdf >= limits.pdf) {

  return res.json({

    success: false,

    message:
      "Daily PDF limit completed. Upgrade to Premium 👑"

  });

}

user.dailyUsage.pdf++;

await user.save();




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

     const startTime = Date.now();

    const userMessage = req.body.message;
    const history = req.body.history || [];
    console.log("History:", history);
    const userId = req.userId || "guest";

    if (!userMessage) {
      return res.status(400).json({ error: "Message required" });
    }
     
    let user = null;

if (userId !== "guest") {

 user = await User.findById(userId);

const subscription = checkSubscription(user);
const limits = getPlanLimits(user);
if (subscription.expired) {

  await user.save();

}
if (
  user &&
  !subscription.premium
) {
    const today = new Date();

const lastReset = new Date(
  user.dailyUsage.lastReset
);

if (
  today.toDateString() !=
  lastReset.toDateString()
) {

  user.dailyUsage.chat = 0;
  user.dailyUsage.pdf = 0;
  user.dailyUsage.image = 0;
  user.dailyUsage.lastReset = today;

  await user.save();

}

if (
  !subscription.premium &&
  user.dailyUsage.chat >= limits.chat
) {

  return res.json({
    success: false,
    message:
      "Daily Free Limit Completed. Upgrade to Premium 👑"
  });

}

user.dailyUsage.chat++;

await user.save();
  }

}
  
app.post("/save-chats", auth, async (req, res) => {

  try {

    const { chats } = req.body;

    let memory = await Memory.findOne({
      userId: req.userId,
    });

    if (!memory) {

      memory = new Memory({
        userId: req.userId,
      });

    }

    memory.chatSessions = chats;

    await memory.save();

    res.json({
      success: true,
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      error: err.message,
    });

  }

});
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

const historyText = memory.chats
  .filter(
    m =>
      m.text &&
      m.text.trim() !== ""
  )
  .slice(-10)
  .map(m => `${m.role}: ${m.text}`)
  .join("\n");
    

const SYSTEM_PROMPT = `
You are VedaAI, an advanced AI assistant created by Yash Krishnat Patil.

=========================
ROLE
=========================

- Be accurate, professional, helpful and friendly.
- Never invent facts.
- If information is uncertain, clearly say so.
- Give practical and easy-to-understand explanations.
- Prefer correctness over guessing.
- Explain difficult topics in a beginner-friendly way while still providing technical depth when needed.

=========================
LANGUAGE
=========================

- Detect ONLY the language of the CURRENT user message.
- Ignore previous message language when deciding the response language.
- Reply ONLY in that language unless the user requests another language.
- If the user mixes languages, naturally reply using the same mixed style.
- Keep technical terms such as Python, JavaScript, API, HTTP, Machine Learning, AI, React, Flutter, MongoDB, JWT, SQL, CSS, HTML, Node.js and Express in English.
- Never translate technical terms unnecessarily.

=========================
ANSWER FORMAT
=========================

Always use clean Markdown.

Never write one huge paragraph.

Always separate sections with blank lines.

Use proper headings.

Use sub-headings whenever needed.

Use numbered lists for processes.

Use bullet lists for features.

Use tables for comparisons.

Use code blocks for code.

Use bold text for important keywords.

Keep answers clean and easy to read.

=========================
STANDARD STRUCTURE
=========================

For concept questions use this format:

# Topic

## Definition

Short definition.

## Explanation

Explain clearly.

## Key Features

- Feature 1
- Feature 2
- Feature 3

## Applications / Uses

- Use 1
- Use 2
- Use 3

## Example

Provide an example if useful.

## Advantages

- Advantage

## Limitations

- Limitation

## Conclusion

2-3 sentence summary.

=========================
PROGRAMMING QUESTIONS
=========================

Always follow this order:

## Problem

## Logic

Explain the approach.

## Code

Use fenced Markdown code blocks.

Example:

\`\`\`javascript
console.log("Hello");
\`\`\`

## Code Explanation

Explain each important part.

## Output

Show expected output whenever possible.

## Time Complexity

Mention when applicable.

## Space Complexity

Mention when applicable.

## Best Practices

Mention better approaches if available.

## Common Mistakes

Mention common beginner mistakes.

=========================
COMPARISON QUESTIONS
=========================

Always use Markdown tables.

Example:

| Feature | Python | Java |
|---------|--------|------|
| Speed | Moderate | Fast |
| Syntax | Easy | Verbose |

After the table provide a short conclusion.

=========================
STEP-BY-STEP QUESTIONS
=========================

Always answer using numbered steps.

Example:

## Steps

1. Step One
2. Step Two
3. Step Three

=========================
LIST QUESTIONS
=========================

Use bullet points.

Keep every item on a separate line.

=========================
MATH
=========================

Show calculations step by step.

Highlight the final answer.

=========================
COMPETITIVE EXAMS
=========================

Give the correct answer first.

Then explain why.

Mention why the other options are incorrect if applicable.

=========================
CODING STYLE
=========================

- Use clean and readable code.
- Add comments only where useful.
- Never generate broken code intentionally.
- Follow modern best practices.
- Prefer secure coding.
- Avoid deprecated APIs whenever possible.

=========================
MEMORY
=========================

Use previous conversation only for context.

Never use previous conversation language for deciding response language.

Always use the CURRENT message language.

=========================
WEB INFORMATION
=========================

If reliable web information is available:

- Prefer latest information.
- Mention recent facts naturally.
- Do not invent news.

=========================
PDF
=========================

If a PDF is available and the user's question relates to it:

- Prefer the uploaded PDF.
- Quote only relevant information.
- Do not ignore PDF context.

=========================
WHEN A QUESTION HAS MULTIPLE MEANINGS
=========================

Choose the meaning that best matches the current conversation.

For example:

If the conversation is about AI or programming,
interpret "ML" as Machine Learning.

Otherwise explain the most common meaning first and then briefly mention alternatives.

=========================
STYLE
=========================

Avoid unnecessary introductions.

Avoid repeating the same information.

Do not generate giant walls of text.

Keep answers well spaced.

Make answers look similar to ChatGPT and Gemini.

=========================
BEHAVIOR
=========================

Be respectful.

Be neutral.

Be honest.

Be helpful.

Always focus on giving the highest quality answer.
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

console.log("========== HISTORY ==========");
console.log(historyText);
console.log("=============================");

const finalPrompt = `
${SYSTEM_PROMPT}

Wikipedia:
${wikiText}

News:
${newsText}

Conversation History:

${historyText}

${pdfInstruction}

Current User Message:
${userMessage}

Assistant:
`;


// ================= GEMINI =================
async function callGeminiStream(userMessage, finalPrompt) {

  let webResults = [];

  if (shouldSearchWeb(userMessage)) {
    console.log("WEB SEARCH ENABLED");
    webResults = await searchWeb(userMessage);
  } else {
    console.log("WEB SEARCH SKIPPED");
  }

  let searchContext = "";

  if (webResults.length > 0) {
    searchContext =
      "Latest web search results:\n\n" +
      webResults
        .map(
          (item, i) =>
            `${i + 1}. ${item.title}\n${item.content}\nSource: ${item.url}`
        )
        .join("\n\n");
  }

  const prompt = `
You are VedaAI.
   Use the web search results below if they are available.
If the web results contain the answer, always prefer them over your internal knowledge.

${searchContext}

${finalPrompt}
`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {

      return await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

    } catch (err) {

      if (err.status === 503 && attempt < 2) {

        console.log("Gemini busy. Retrying stream...");

        await new Promise(r => setTimeout(r, 1000));

        continue;
      }

      throw err;
    }
  }
}
// ================= CALL GEMINI =================
res.setHeader("Content-Type", "text/plain; charset=utf-8");
res.setHeader("Transfer-Encoding", "chunked");

if (isGreeting(userMessage)) {

  res.write("Hello! 👋 How can I help you today?");
  return res.end();

}

const stream = await callGeminiStream(
  userMessage,
  finalPrompt
);

let aiText = "";
console.log("========== GEMINI DEBUG ==========");
console.log("API KEY EXISTS:", !!API_KEY);
console.log("API KEY LENGTH:", API_KEY ? API_KEY.length : 0);
console.log("API KEY PREFIX:", API_KEY ? API_KEY.substring(0, 6) : "NONE");
console.log("=================================");



// ================= AI RESPONSE =================
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");
res.setHeader("Transfer-Encoding", "chunked");

for await (const chunk of stream) {

  const text = chunk.text || "";

  aiText += text;

  res.write(text);

}


// ================= SAVE CHAT =================

memory.chats.push({
  role: "assistant",
  text: aiText
});

await memory.save();


// ================= RESPONSE =================

res.end();

} catch (err) {

  console.log("========== GEMINI ERROR ==========");
  console.log(err);

   if (
  err.status === 503 ||
  err.message.includes("503") ||
  err.message.includes("UNAVAILABLE") ||
  err.message.includes("429") ||
  err.message.includes("RESOURCE_EXHAUSTED")
) {
  return res.status(503).json({
    success: false,
    message: "AI is temporarily busy. Please try again in a few seconds."
  });
}

  return res.status(500).json({
    error: "Server Error",
    details: err.message
  });

}

});
    
  

app.post("/create-order", auth, async (req, res) => {
  try {
    
    const user = await User.findById(req.userId);

if (!user) {

  return res.status(404).json({
    error: "User not found"
  });

}
const subscription = checkSubscription(user);


if (subscription.premium) {

  return res.status(400).json({

    success: false,

    message: "Premium already active."

  });

}

    const { plan } = req.body;

    if (
  plan !== "monthly" &&
  plan !== "yearly"
) {

  return res.status(400).json({
    success: false,
    message: "Invalid subscription plan."
  });

}

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

  notes: {
    userId: user._id.toString(),
    plan: plan
  }

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

app.post("/verify-payment", auth, async (req, res) => {

console.log("VERIFY PAYMENT CALLED");
console.log(req.body);

try {

const {
 razorpay_order_id,
 razorpay_payment_id,
 razorpay_signature
} = req.body;


const userId = req.userId;


// 1. Signature verify

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
.update(body)
.digest("hex");


if(expectedSignature !== razorpay_signature){

return res.status(400).json({
success:false,
message:"Invalid signature"
});

}


// 2. Check actual payment status from Razorpay

const payment = await razorpay.payments.fetch(
  razorpay_payment_id
);

console.log(JSON.stringify(payment, null, 2));

if (payment.status !== "captured") {
  return res.status(400).json({
    success: false,
    message: "Payment not captured"
  });
}

// 3. Fetch user AFTER payment success

const user =
await User.findById(userId);


if(!user){

return res.status(404).json({
success:false,
message:"User not found"
});

}


// 4. Get plan from order

const order =
await razorpay.orders.fetch(
razorpay_order_id
);


const verifiedPlan =
order.notes.plan;



// 5. Activate premium

user.isPremium = true;

user.subscriptionType =
verifiedPlan;


user.subscriptionStart =
new Date();



if(verifiedPlan === "yearly"){

user.subscriptionExpiry =
new Date(
Date.now()
+
365*24*60*60*1000
);


}else{


user.subscriptionExpiry =
new Date(
Date.now()
+
30*24*60*60*1000
);


}


await user.save();



console.log("PREMIUM ACTIVATED");


return res.json({

success:true,

message:"Premium activated",

isPremium:true,

subscriptionType:user.subscriptionType,

subscriptionExpiry:user.subscriptionExpiry

});


}
catch(error){

console.log(error);

res.status(500).json({

success:false,

message:"Verification failed"

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
