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
require("dotenv").config();

const User = require("./models/User");

const app = express();
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

  pdfUri: {
    type: String,
    default: ""
  },

  pdfMimeType: {
    type: String,
    default: ""
  },

  messages: [
    {
      role: String,
      text: String
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
// ================= SIGNUP =================
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const exist = await User.findOne({ email });
    if (exist) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hash
    });

    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Signup successful",
      token,
      userId: user._id
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= LOGIN =================
app.post("/login", async (req, res) => {
  try {

    console.log("BODY =", req.body);

    const users = await User.find();

    console.log("===== ALL USERS =====");
    console.log(users);

    const { email, password } = req.body;

    const user = await User.findOne({ email });

    console.log("FOUND USER =", user);

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
      return res.status(400).json({
        error: "Wrong password"
      });
    }

    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Login successful",
      token,
      userId: user._id
    });

  } catch (err) {

    return res.status(500).json({
      error: err.message
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
app.post("/image", upload.single("image"), async (req, res) => {

  try {

    console.log("IMAGE RECEIVED:");
    console.log(req.file);

    if (!req.file) {
      return res.status(400).json({
        error: "No image uploaded"
      });
    }

    const imageBuffer = fs.readFileSync(req.file.path);

    const imageBase64 = imageBuffer.toString("base64");

    const response = await axios.post(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
  {
    contents: [
      {
        parts: [
          {
            text: "Describe this image in detail."
          },
          {
            inline_data: {
              mime_type: req.file.mimetype,
              data: imageBase64
            }
          }
        ]
      }
    ]
  }
);

const aiText =
  response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
  "No response from AI";

return res.json({
  reply: aiText
});

  } catch (err) {

  if (err.response?.status === 503) {
    return res.status(503).json({
      error: "AI Vision is temporarily busy. Please try again."
    });
  }

  console.log("IMAGE ERROR:");
  console.log(err.message);
  console.log(err.response?.data);

  return res.status(500).json({
    error: "Image upload failed",
    details: err.response?.data || err.message
  });

}

});

app.post("/pdf", upload.single("pdf"), async (req, res) => {
console.log(req.file);
  try {

    if (!req.file) {
      return res.status(400).json({
        error: "No PDF uploaded"
      });
    }
const pdfBuffer = fs.readFileSync(req.file.path);


const pdfData = await pdfParse(pdfBuffer);

currentPdfText = pdfData.text;

console.log("PDF TEXT LENGTH:", pdfData.text.length);
console.log(pdfData.text.substring(0, 300));
console.log(pdfData.info);
console.log(pdfData.metadata);
console.log(JSON.stringify(pdfData, null, 2));

const response = await axios.post(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
  {
    contents: [
      {
        parts: [
          {
            text: `
You are VedaAI, an intelligent AI assistant.

Analyze the uploaded PDF carefully.

PDF Content:
${pdfData.text}

Instructions:

1. Detect what type of PDF it is.
   - Notes
   - Question Paper
   - Resume
   - Research Paper
   - Invoice/Bill
   - Assignment
   - Report
   - Book
   - Other

2. Based on the PDF type:

- If Notes:
  • Give a chapter-wise summary.
  • Highlight important concepts.
  • List important exam questions.

- If Question Paper:
  • Solve every question.
  • Explain answers in simple language.

- If Resume:
  • Review the resume.
  • Suggest improvements.

- If Research Paper:
  • Explain in simple language.
  • Mention key findings.

- If Invoice/Bill:
  • Extract important details like date, amount, company, GST, etc.

- If Assignment:
  • Answer all questions.

3. If the user asks in Marathi, answer in Marathi.
If the user asks in English, answer in English.
If the user asks in Hindi, answer in Hindi.

Always give a well-structured response using headings and bullet points.
`
          }
        ]
      }
    ]
  }
);

const aiText =
  response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
  "No response from AI";

return res.json({
  reply: aiText
});
  } catch (err) {

  console.log("PDF ERROR:");
  console.log(err.message);
  console.log(err.response?.status);
  console.log(err.response?.data);

  return res.status(500).json({
    error: "PDF parsing failed",
    details: err.response?.data || err.message
  });

}

});
app.post("/upload-pdf", auth, upload.single("pdf"), async (req, res) => {
const prompt = req.body.prompt || "Summarize this PDF.";
  try {

    if (!req.file) {
      return res.status(400).json({
        error: "No PDF uploaded"
      });
    }

    const uploadedFile = await ai.files.upload({
      file: req.file.path,
      config: {
        mimeType: "application/pdf",
      },
    });

    console.log("Uploaded File:");
    console.log(uploadedFile);
    
    const userId = req.userId || "guest";

let memory = await Memory.findOne({ userId });

if (!memory) {
  memory = new Memory({
    userId,
    messages: []
  });
}

memory.pdfUri = uploadedFile.uri;
memory.pdfMimeType = uploadedFile.mimeType;

await memory.save();

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                fileUri: uploadedFile.uri,
                mimeType: uploadedFile.mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
    });

    const aiReply = result.text;
    
   fs.unlinkSync(req.file.path);

    return res.json({
      reply: aiReply,
    });

  } catch (err) {

    console.log(err);

    return res.status(500).json({
      error: err.message
    });

  }

});
app.post("/pdf-chat", async (req, res) => {

  try {

    const { message } = req.body;

    if (!currentPdfText) {
      return res.status(400).json({
        error: "No PDF uploaded"
      });
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: `
You are VedaAI.

PDF Content:

${currentPdfText.substring(0, 15000)}

User Question:

${message}

Answer only using the PDF.
`
              }
            ]
          }
        ]
      }
    );

    const aiText =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response";

    return res.json({
      reply: aiText
    });

  } catch (err) {

    console.log(err.message);

    return res.status(500).json({
      error: "PDF Chat failed"
    });

  }

});
// ================= CHAT =================
app.post("/chat", async (req, res) => {
  try {

    const userMessage = req.body.message;
    const userId = req.userId || "guest";

    if (!userMessage) {
      return res.status(400).json({ error: "Message required" });
    }

    // ================= MEMORY =================
    let memory = await Memory.findOne({ userId });

    if (!memory) {
      memory = new Memory({
        userId,
        messages: []
      });
    }

    memory.messages.push({
      role: "user",
      text: userMessage
    });

    await memory.save();

    // ================= AI INPUT =================
    const wikiText = await searchWikipedia(userMessage);
    const newsText = await getNews(userMessage);

    const history = memory.messages.slice(-10)
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


const finalPrompt = `
${SYSTEM_PROMPT}

Wikipedia:
${wikiText}

News:
${newsText}

History:
${history}

User:
${userMessage}

Assistant:
`;



    // ================= GEMINI =================
  async function callGemini(finalPrompt) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

  let retries = 3;

  while (retries > 0) {
    try {
      const response = await axios.post(url, {
        contents: [
          {
            parts: [
              {
                text: finalPrompt
              }
            ]
          }
        ]
      });

      return response;

    } catch (err) {

      if (err.response?.status === 503) {

        retries--;

        console.log(`Retrying... Remaining: ${retries}`);

        if (retries === 0) {
          throw err;
        }

        await new Promise(resolve =>
          setTimeout(resolve, 2000)
        );

      } else {

        throw err;

      }

    }
  }
}

let aiText =
  response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

if (!aiText) aiText = "No response from AI";

memory.messages.push({
  role: "assistant",
  text: aiText
});

await memory.save();

return res.json({ reply: aiText });

  }  catch (err) {

  console.log("ERROR MESSAGE:");
  console.log(err.message);

  console.log("ERROR STATUS:");
  console.log(err.response?.status);

  console.log("ERROR DATA:");
  console.log(err.response?.data);


  return res.status(500).json({
    error: "Server Error",
    details: err.message
  });

}
});

// ================= HOME =================
app.get("/", (req, res) => {
  res.send("🔥 VedaAI backend running");
});

// ================= SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🔥 VedaAI running on port ${PORT}`);
});