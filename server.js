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
const User = require("./models/User");

require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "vedaai_secret_key";

mongoose.connect(
  process.env.MONGODB_URI,
  {
    serverSelectionTimeoutMS: 5000
  }
)
.then(() => {
  console.log("✅ MongoDB Connected");
})
.catch(err => {
  console.log("❌ MongoDB Error:", err);
});

const MemorySchema = new mongoose.Schema({

  userId: String,

  profile: {
    name: String,
    city: String,
    birthday: String,
    favoriteColor: String
  },

  messages: [
    {
      role: String,
      text: String
    }
  ]

}, {
  timestamps: true
});

const Memory = mongoose.model("Memory", MemorySchema);

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: "logs.log"
    })
  ]
});
const app = express();

app.use(helmet());

app.use(cors({
  origin: "*"
}));

app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many requests, please try again later."
});

app.use(limiter);

app.use((req, res, next) => {
  logger.info({
    method: req.method,
    url: req.url,
    time: new Date().toISOString()
  });

  next();
});

const APP_INFO = {
  name: "VedaAI",
  owner: "Yash Krishnat Patil",
  version: "1.0.0"
};

const API_KEY = process.env.GEMINI_API_KEY;
const newsapi = new NewsAPI(process.env.NEWS_API_KEY);


if (!API_KEY) {
  console.error("❌ GEMINI API KEY NOT FOUND");
  process.exit(1);
}

console.log("✅ API KEY LOADED");

// ================= MEMORY =================



// ================= SYSTEM PROMPT =================

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
- If the user's name appears in History, remember it and use it.
- Never ignore facts stored in History.
- Example:
History:
user: My name is John

User:
What is my name?

Assistant:
Your name is John.


CODING RULES
- Generate clean, working and well-commented code.
- Debug errors step-by-step.
- Explain code in simple language.

BEHAVIOR
- Stay helpful, respectful and neutral.
- Avoid unnecessary refusals.
- Provide the best possible answer with available knowledge.


`;
async function searchWikipedia(query) {
  try {
    const page = await wiki.page(query);
    const summary = await page.summary();

    return summary?.extract?.slice(0, 1500) || "";
  } catch {
    return "";
  }
}

async function getNews(query) {
  try {
    const response = await newsapi.v2.everything({
      q: query,
      language: "en",
      pageSize: 3
    });

    return response.articles
      .map(a => {
        const title = a.title || "";
        const desc = a.description || "";
        return `${title}\n${desc}`;
      })
      .join("\n\n");
  } catch {
    return "";
  }
}

async function webSearch(query) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;

    const res = await axios.get(url);

    return res.data?.AbstractText || "";
  } catch {
    return "";
  }
}
function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}
// ================= HOME =================

app.get("/", (req, res) => {
  res.send("🔥 VedaAI backend running");
});

// ================= CHAT =================
app.post("/chat", auth, async (req, res) => {
  try {

    const userMessage = req.body.message;
    if (!userMessage) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

   const userId = req.userId;

    app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Validation
    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password required"
      });
    }

    // 2. Check user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        error: "User already exists"
      });
    }

    // 3. Password hash
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword
    });

    // 5. JWT Token
    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 6. Response
    res.json({
      message: "Signup successful",
      token,
      userId: user._id
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ error: "Wrong password" });
    }

    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      userId: user._id
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function auth(req, res, next) {
  try {
    const token = req.headers.authorization;

    // 1. Token check
    if (!token) {
      return res.status(401).json({
        error: "No token provided"
      });
    }

    // 2. Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // 3. userId request मध्ये store करा
    req.userId = decoded.userId;

    next();

  } catch (err) {
    return res.status(401).json({
      error: "Invalid token"
    });
  }
}

   
    // ================= VALIDATION =================
    if (!userMessage) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (typeof userMessage !== "string") {
      return res.status(400).json({ error: "Invalid message format" });
    }

    if (userMessage.length > 1000) {
      return res.status(400).json({ error: "Message too long (max 1000 characters)" });
    }

    // ================= MEMORY INIT =================
    let userMemory = await Memory.findOne({ userId });

    if (!userMemory) {
      userMemory = new Memory({
        userId,
        profile: {},
        messages: []
      });
    }

    const lower = userMessage.toLowerCase();

    // ================= SAVE NAME (PROFILE MEMORY) =================
    if (
      lower.includes("my name is") ||
      userMessage.includes("माझं नाव")
    ) {
      let name = "";

      if (lower.includes("my name is")) {
        name = userMessage.split(/my name is/i)[1]?.trim();
      }

      if (userMessage.includes("माझं नाव")) {
        name = userMessage.split("माझं नाव")[1]
          ?.replace("आहे", "")
          .trim();
      }

      if (name) {
        userMemory.profile.name = name;
        await userMemory.save();

        return res.json({
          reply: `Okay! I'll remember that your name is ${name}.`
        });
      }
    }

    // ================= GET NAME =================
    if (
      lower.includes("what is my name") ||
      lower.includes("what's my name") ||
      lower.includes("tell me my name") ||
      userMessage.includes("माझं नाव काय")
    ) {
      if (userMemory.profile.name) {
        return res.json({
          reply: `Your name is ${userMemory.profile.name}`
        });
      }

      return res.json({
        reply: "I don't know your name yet."
      });
    }
function isOwnerQuery(text) {
  const lower = text.toLowerCase();

  return (
    lower.includes("owner") ||
    lower.includes("who created") ||
    lower.includes("who made") ||
    lower.includes("chat gpt owner") ||
    text.includes("कोणी बनवले") ||
    text.includes("मालक कोण")
  );
}
    // ================= SPECIAL CASE =================
    const CURRENT_YEAR = new Date().getFullYear();

    if (lower === "current year") {
      return res.json({ reply: String(CURRENT_YEAR) });
    }

    // ================= HISTORY =================
    const history = userMemory.messages
      .slice(-10)
      .map(m => `${m.role}: ${m.text}`)
      .join("\n");

    // ================= API CALLS =================
    const [wikiText, webText, newsText] = await Promise.all([
      searchWikipedia(userMessage),
      webSearch(userMessage),
      getNews(userMessage)
    ]);

    const finalPrompt = `
CURRENT_YEAR = ${CURRENT_YEAR}

${SYSTEM_PROMPT}

Wikipedia:
${wikiText}

Web:
${webText}

News:
${newsText}

History:
${history}

User:
${userMessage}

Assistant:
`;



    // GEMINI CALL
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: finalPrompt }]
          }
        ]
      }
    );

    let aiText =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      aiText = "No response from AI";
    }

    // replace wrong years
    aiText = aiText.replace(/\b(2023|2024|2025)\b/g, CURRENT_YEAR);

userMemory.messages.push(
  {
    role: "user",
    text: userMessage
  },
  {
    role: "assistant",
    text: aiText
  }
);
if (isOwnerQuery(userMessage)) {
  return res.json({
    reply: "VedaAI is created by Yash Krishnat Patil."
  });
} 
if (userMemory.messages.length > 40) {
  userMemory.messages =
    userMemory.messages.slice(-40);
}

await userMemory.save();

return res.json({
  reply: aiText
});
    
    

  } catch (err) {
    console.log("❌ ERROR:");
    console.log(err?.response?.data || err.message);

    return res.status(500).json({
      error: "Server Error",
      details: err?.response?.data || err.message
    });
  }
});

// ================= SERVER =================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 VedaAI running on port ${PORT}`);
});