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


// ================= SMART WEB SEARCH DECISION =================
function shouldSearchWeb(query, history = []) {

  if (!query || typeof query !== "string") {
    return false;
  }

  const q = query.toLowerCase().trim();

  // ============================================================
  // 1. EXPLICIT SEARCH / VERIFICATION REQUEST
  // ============================================================

  const explicitSearchKeywords = [
    "search this",
    "search web",
    "search online",
    "look up",
    "find online",
    "check online",
    "check this",
    "verify this",
    "verify online",
    "search kar",
    "check kar",
    "verify kar",
    "online check kar",
    "internet var bagh",
    "google var bagh",
    "तपासून सांग",
    "तपासून सांगा",
    "खरं आहे का",
    "खरे आहे का",
    "खरं आहे की नाही",
    "verify करून सांग",
    "शोधून सांग",
    "शोधून सांगा",
    "ऑनलाइन तपासा"
  ];

  if (explicitSearchKeywords.some(k => q.includes(k))) {
    return true;
  }

  // ============================================================
  // 2. CURRENT / LIVE / LATEST INFORMATION
  // ============================================================

  const currentKeywords = [
    "today",
    "latest",
    "current",
    "currently",
    "now",
    "right now",
    "just now",
    "live",
    "recent",
    "recently",
    "breaking",
    "this year",
    "this month",
    "this week",

    "आज",
    "आत्ता",
    "सध्या",
    "आत्ताचा",
    "आत्ताची",
    "आत्ताचे",
    "सध्याचा",
    "सध्याची",
    "सध्याचे",
    "ताजा",
    "ताजे",
    "ताजी",
    "ताज्या",
    "नवीनतम",
    "अलीकडील"
  ];

  if (currentKeywords.some(k => q.includes(k))) {
    return true;
  }

  // ============================================================
  // 3. SPORTS / LIVE SCORE
  // ============================================================

  const sportsKeywords = [
    "cricket",
    "football",
    "tennis",
    "ipl",
    "match",
    "score",
    "live score",
    "current score",
    "runs",
    "wicket",
    "overs",
    "result",
    "winner",
    "schedule",
    "points table",
    "ranking",
    "world cup",
    "championship",

    "सामना",
    "स्कोअर",
    "स्कोर",
    "धावा",
    "विकेट",
    "ओव्हर",
    "निकाल",
    "विजेता",
    "वेळापत्रक"
  ];

  if (sportsKeywords.some(k => q.includes(k))) {
    return true;
  }

  // ============================================================
  // 4. NEWS
  // ============================================================

  const newsKeywords = [
    "news",
    "latest news",
    "today news",
    "breaking news",
    "news today",
    "बातमी",
    "बातम्या",
    "आजच्या बातम्या",
    "ताज्या बातम्या",
    "न्यूज",
    "समाचार"
  ];

  if (newsKeywords.some(k => q.includes(k))) {
    return true;
  }

  // ============================================================
  // 5. MONEY / MARKET / PRICES
  // ============================================================

  const financeKeywords = [
    "gold price",
    "gold rate",
    "silver price",
    "silver rate",
    "stock price",
    "share price",
    "market price",
    "sensex",
    "nifty",
    "bitcoin",
    "crypto",
    "cryptocurrency",
    "exchange rate",
    "dollar rate",
    "rupee rate",
    "usd inr",
    "forex",

    "gold cha rate",
    "gold cha price",
    "gold price kiti",
    "सोन्याचा भाव",
    "सोन्याचे भाव",
    "सोन्याचा दर",
    "सोन्याचे दर",
    "सोने किती",
    "चांदीचा भाव",
    "चांदीचे भाव",
    "चांदीचा दर",
    "शेअर भाव",
    "शेअर किंमत",
    "बाजारभाव",
    "डॉलरचा भाव"
  ];

  if (financeKeywords.some(k => q.includes(k))) {
    return true;
  }

  // ============================================================
  // 6. WEATHER
  // ============================================================

  const weatherKeywords = [
    "weather",
    "temperature",
    "forecast",
    "rain",
    "rainfall",
    "humidity",
    "climate",

    "हवामान",
    "तापमान",
    "पाऊस",
    "पावसाचा अंदाज",
    "हवामानाचा अंदाज"
  ];

  if (weatherKeywords.some(k => q.includes(k))) {
    return true;
  }

  // ============================================================
  // 7. GOVERNMENT / POLITICS / ELECTION
  // ============================================================

  const governmentKeywords = [
    "prime minister",
    "president",
    "chief minister",
    "deputy chief minister",
    "minister",
    "mp",
    "mla",
    "government",
    "election",
    "politician",
    "political party",
    "cabinet",

    "पंतप्रधान",
    "राष्ट्रपती",
    "मुख्यमंत्री",
    "उपमुख्यमंत्री",
    "मंत्री",
    "आमदार",
    "खासदार",
    "सरकार",
    "निवडणूक",
    "राजकारणी",
    "राजकीय पक्ष",
    "मंत्रिमंडळ"
  ];

  if (governmentKeywords.some(k => q.includes(k))) {
    return true;
  }

  // ============================================================
  // 8. GOVERNMENT SCHEMES / JOBS / SCHOLARSHIPS
  // ============================================================

  const schemeKeywords = [
    "government scheme",
    "govt scheme",
    "new scheme",
    "latest scheme",
    "scholarship",
    "government job",
    "latest job",
    "vacancy",
    "recruitment",
    "notification",

    "सरकारी योजना",
    "शासकीय योजना",
    "नवीन योजना",
    "शिष्यवृत्ती",
    "सरकारी नोकरी",
    "भरती",
    "जाहिरात",
    "अधिसूचना"
  ];

  if (schemeKeywords.some(k => q.includes(k))) {
    return true;
  }

  // ============================================================
  // 9. TECHNOLOGY / SOFTWARE CURRENT INFORMATION
  // ============================================================

  const technologyKeywords = [
    "latest version",
    "current version",
    "new version",
    "latest update",
    "new update",
    "release",
    "released",
    "documentation",
    "official documentation",
    "api docs",
    "latest api",
    "new feature",
    "latest feature",
    "deprecated",

    "नवीन version",
    "नवीन अपडेट",
    "नवीन feature",
    "नवीन आवृत्ती"
  ];

  if (technologyKeywords.some(k => q.includes(k))) {
    return true;
  }

  // ============================================================
  // 10. YEAR DETECTION
  // ============================================================

  const yearPattern =
    /\b(2024|2025|2026|2027|2028|2029|2030)\b/;

  if (yearPattern.test(q)) {
    return true;
  }

  // ============================================================
  // 11. PERSON / COMPANY / LOCATION RESEARCH
  // ============================================================

  const researchKeywords = [
    "who is",
    "who are",
    "information about",
    "information on",
    "details about",
    "details of",
    "profile of",
    "biography of",

    "कोण आहेत",
    "कोण आहे",
    "माहिती दे",
    "माहिती सांगा",
    "माहिती पाहिजे",
    "यांच्याबद्दल",
    "याच्याबद्दल"
  ];

  if (researchKeywords.some(k => q.includes(k))) {
    return true;
  }

  // ============================================================
  // 12. LOCATION BASED QUESTIONS
  // ============================================================

  const locationKeywords = [
    "kolhapur",
    "panhala",
    "pune",
    "mumbai",
    "maharashtra",
    "india",

    "कोल्हापूर",
    "पन्हाळा",
    "पुणे",
    "मुंबई",
    "महाराष्ट्र",
    "भारत"
  ];

  const locationQuestionKeywords = [
    "near",
    "nearby",
    "in",
    "around",
    "मधला",
    "मधली",
    "मधले",
    "जवळ",
    "मध्ये",
    "इथे",
    "इथला",
    "इथली",
    "इथले"
  ];

  const hasLocation =
    locationKeywords.some(k => q.includes(k));

  const hasLocationQuestion =
    locationQuestionKeywords.some(k => q.includes(k));

  if (hasLocation && hasLocationQuestion) {
    return true;
  }

  // ============================================================
  // 13. FOLLOW-UP / CONTEXT BASED SEARCH
  // ============================================================
  // Example:
  // User: आज India ची match आहे
  // User: आत्ता score किती?
  //
  // "score" current message मध्ये आहे,
  // पण खाली history देखील तपासली जाते.

  if (Array.isArray(history) && history.length > 0) {

    const recentHistory = history
      .slice(-6)
      .map(msg => msg?.text || "")
      .join(" ")
      .toLowerCase();

    const contextKeywords = [
      "match",
      "cricket",
      "football",
      "score",
      "gold",
      "silver",
      "stock",
      "share",
      "weather",
      "news",
      "election",
      "minister",
      "government",
      "price",
      "rate",

      "सामना",
      "स्कोअर",
      "स्कोर",
      "सोने",
      "सोन्याचा",
      "चांदी",
      "हवामान",
      "बातमी",
      "निवडणूक",
      "मंत्री",
      "सरकार",
      "भाव",
      "दर"
    ];

    const currentQuestionIsShort =
      q.split(/\s+/).length <= 12;

    const historyHasCurrentTopic =
      contextKeywords.some(k =>
        recentHistory.includes(k)
      );

    const followUpWords = [
      "score",
      "current score",
      "result",
      "winner",
      "how much",
      "price",
      "rate",
      "now",
      "right now",
      "latest",

      "किती",
      "किती आहे",
      "आत्ता",
      "सध्या",
      "आत्ताचा",
      "आत्ताची",
      "आत्ताचे",
      "निकाल",
      "भाव",
      "दर"
    ];

    const looksLikeFollowUp =
      followUpWords.some(k => q.includes(k));

    if (
      currentQuestionIsShort &&
      historyHasCurrentTopic &&
      looksLikeFollowUp
    ) {
      console.log("🧠 CONTEXT WEB SEARCH ENABLED");
      return true;
    }
  }

  // ============================================================
  // DEFAULT
  // ============================================================

  return false;
}

// ================= WEB CACHE =================
const webCache = new Map();

const CACHE_TIME = 10 * 60 * 1000; // 10 minutes


// ================= BUILD SMART SEARCH QUERY =================
function buildSearchQuery(query, history = []) {

  if (!query || typeof query !== "string") {
    return "";
  }

  const currentQuestion = query.trim();

  // --------------------------------------------------
  // Get recent conversation context
  // --------------------------------------------------

  let context = "";

  if (Array.isArray(history) && history.length > 0) {

    context = history
      .slice(-6)
      .filter(msg =>
        msg &&
        msg.text &&
        msg.thinking !== true
      )
      .map(msg => msg.text)
      .join(" ");
  }

  // --------------------------------------------------
  // If current question is already complete,
  // search it directly.
  // --------------------------------------------------

  const shortQuestion =
    currentQuestion.split(/\s+/).length <= 12;

  const followUpWords = [
    "score",
    "current score",
    "live score",
    "result",
    "winner",
    "price",
    "rate",
    "latest",
    "current",
    "now",
    "right now",

    "किती",
    "किती आहे",
    "आत्ता",
    "सध्या",
    "निकाल",
    "भाव",
    "दर",
    "सध्याचा",
    "सध्याची",
    "सध्याचे"
  ];

  const isFollowUp =
    followUpWords.some(word =>
      currentQuestion.toLowerCase().includes(word)
    );

  // --------------------------------------------------
  // Context-based search
  // --------------------------------------------------

  if (
    shortQuestion &&
    isFollowUp &&
    context.trim()
  ) {

    const smartQuery =
      `${context} ${currentQuestion}`;

    console.log("🧠 SMART SEARCH QUERY:");
    console.log(smartQuery);

    return smartQuery.substring(0, 400);
  }

  // --------------------------------------------------
  // Normal search
  // --------------------------------------------------

  return currentQuestion.substring(0, 400);
}


// ================= WEB SEARCH =================
async function searchWeb(query, history = []) {

  try {

    const searchStart = Date.now();

    // Build context-aware search query
    const searchQuery =
      buildSearchQuery(query, history);

    if (!searchQuery) {
      return [];
    }

    const key =
      searchQuery.trim().toLowerCase();

    // --------------------------------------------------
    // CACHE CHECK
    // --------------------------------------------------

    const cached = webCache.get(key);

    if (
      cached &&
      Date.now() - cached.time < CACHE_TIME
    ) {

      console.log("✅ WEB CACHE HIT");

      console.log(
        `TAVILY TIME: ${
          Date.now() - searchStart
        } ms (CACHE)`
      );

      return cached.results;
    }

    console.log("🌐 WEB CACHE MISS");

    console.log(
      "🔎 TAVILY SEARCH QUERY:",
      searchQuery
    );

    // --------------------------------------------------
    // TAVILY SEARCH
    // --------------------------------------------------

    const response = await axios.post(
      "https://api.tavily.com/search",
      {
        api_key: process.env.TAVILY_API_KEY,

        query: searchQuery,

        search_depth: "advanced",

        max_results: 5,
      }
    );

    const results =
      response.data.results || [];

    // --------------------------------------------------
    // SAVE CACHE
    // --------------------------------------------------

    webCache.set(key, {
      results,
      time: Date.now(),
    });

    console.log(
      `🌐 TAVILY TIME: ${
        Date.now() - searchStart
      } ms`
    );

    console.log(
      "📚 WEB RESULTS:",
      results.length
    );

    return results;

  } catch (err) {

    console.log(
      "❌ TAVILY ERROR:",
      err.response?.data ||
      err.message
    );

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

/*
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
*/

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
app.use(express.json({
  limit: "20mb"
}));

app.use(express.urlencoded({
  extended: true,
  limit: "20mb"
}));
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
chatSessions: [
  {
    id: String,

    title: String,

    favorite: {
      type: Boolean,
      default: false,
    },

    messageCount: {
      type: Number,
      default: 0,
    },

    paused: {
      type: Boolean,
      default: false,
    },

    resetTime: Date,

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

  email: user.email,   

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
    const chatId = req.body.chatId;

    console.log("Chat ID:", chatId);
    console.log("History:", history);
    console.log("REQ HISTORY");
    console.log(JSON.stringify(history, null, 2));
    console.log("✅ PASSED HISTORY");
    console.log("🔍 STEP AFTER HISTORY");
const userId = req.userId || "guest";
console.log("🔍 USER ID:", userId);
    if (!userMessage) {
      return res.status(400).json({ error: "Message required" });
    }
     
    let user = null;

if (userId !== "guest") {

 user = await User.findById(userId);
console.log("🔥 USER FOUND:", !!user);

const subscription = checkSubscription(user);
console.log("🔥 SUBSCRIPTION CHECKED");
const limits = getPlanLimits(user);
console.log("🔥 PLAN LIMITS CHECKED");
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


// ================= MEMORY =================
let memory = await Memory.findOne({ userId });
console.log("🔥 MEMORY FOUND:", !!memory);
if (!memory) {
  memory = new Memory({
    userId,
    chatSessions: [],
  });

  await memory.save();
}
console.log("🔥 REQUEST CHAT ID:", chatId);

console.log(
  "🔥 SAVED CHAT IDS:",
  memory.chatSessions.map(chat => chat.id)
);

let currentChat = memory.chatSessions.find(
  (chat) => chat.id === chatId
);

console.log("🔥 CURRENT CHAT FOUND:", !!currentChat);

if (!currentChat) {

  console.log("🆕 CHAT NOT FOUND — CREATING NEW CHAT");

  currentChat = {
    id: chatId,
    title: userMessage.substring(0, 40),
    favorite: false,
    messageCount: 0,
    paused: false,
    resetTime: null,
    messages: []
  };

  memory.chatSessions.push(currentChat);

  await memory.save();

  console.log("✅ NEW CHAT SAVED:", chatId);
}

console.log("🔥 PASSED CURRENT CHAT");
// ================= CHAT LIMIT =================

if (currentChat.paused) {

  if (
    currentChat.resetTime &&
    new Date() < new Date(currentChat.resetTime)
  ) {

    return res.json({
      success: false,
      paused: true,
      resetTime: currentChat.resetTime,
      message:
        "This chat is temporarily paused."
    });

  }

  // Reset chat automatically
  currentChat.paused = false;
  currentChat.messageCount = 0;
  currentChat.resetTime = null;

  await memory.save();
}
console.log("🔥 PASSED CHAT LIMIT");


// ================= MESSAGE LIMIT =================

if (
  user &&
  user.role !== "owner" &&
  !checkSubscription(user).premium &&
  currentChat.messageCount >= 50
) {

  currentChat.paused = true;

  currentChat.resetTime = new Date(
    Date.now() + 4 * 60 * 60 * 1000
  );

  await memory.save();

  return res.json({
    success: false,
    paused: true,
    resetTime: currentChat.resetTime,
    message:
      "This chat has reached its limit. Try again after the timer ends or start a new chat."
  });

}

// ================= CURRENT CHAT =================

// Save user message
currentChat.messages.push({
  role: "user",
  text: userMessage
});

currentChat.messageCount =
  (currentChat.messageCount || 0) + 1;

console.log(
  "Current Chat Messages:",
  currentChat.messageCount
);

await memory.save();

// ================= AI INPUT =================
let wikiText = "";
let newsText = "";

if (shouldSearchWeb(userMessage, history)) {
  [wikiText, newsText] = await Promise.all([
    searchWikipedia(userMessage),
    getNews(userMessage),
  ]);
}

const historyText = history
  .filter(
    msg =>
      msg.text &&
      msg.text.trim() !== "" &&
      msg.thinking !== true
  )
  .slice(-15)
  .map(msg => {
    const role =
      msg.role === "user"
        ? "User"
        : "Assistant";

    return `${role}: ${msg.text}`;
  })
  .join("\n\n");

const SYSTEM_PROMPT = `
You are VedaAI, an advanced general-purpose AI assistant created by Yash Krishnat Patil.

Your mission is to understand the user's actual intention, use conversation context, provide accurate information, explain clearly, solve problems, verify important information when tools are available, and guide the user toward the next useful step.

You are a:

- General AI Assistant
- Teacher
- Mentor
- Programmer
- Software Engineer
- App Development Guide
- Web Development Expert
- Debugging Assistant
- Research Assistant
- Study Partner
- Career Guide
- Technical Consultant
- Problem Solver
- Writing Assistant
- Document Assistant
- Mathematics Assistant
- Science Assistant
- Technology Assistant
- Planning Assistant

Your core process is:

UNDERSTAND → CONTEXT → ANALYZE → VERIFY → SOLVE → EXPLAIN → GUIDE

==================================================
1. UNIVERSAL QUESTION HANDLING
==================================================

Handle a very wide range of questions.

Topics may include:

- General knowledge
- Current affairs
- News
- Government
- Politics
- History
- Geography
- Science
- Mathematics
- Computer Science
- Programming
- Software Engineering
- Web Development
- Mobile App Development
- Flutter
- React
- Node.js
- Express
- JavaScript
- Python
- Java
- C
- C++
- SQL
- MongoDB
- Firebase
- APIs
- HTTP
- Authentication
- JWT
- Cyber Security
- Networking
- Cloud Computing
- Artificial Intelligence
- Machine Learning
- Data Science
- Generative AI
- Databases
- DevOps
- Git
- GitHub
- UI/UX
- Product Development
- Startups
- Business
- Career
- Resume
- Interviews
- Education
- Competitive examinations
- College projects
- Research
- Documentation
- PDFs
- Images
- Files
- Writing
- Translation
- Summarization
- Planning
- Troubleshooting
- Learning
- Everyday questions

This list is not exhaustive.

If the topic is not listed, do not automatically say that you cannot answer.

Instead:

1. Understand the question.
2. Identify the task.
3. Use available knowledge and tools.
4. Give the best reliable answer.
5. Clearly explain limitations when necessary.

==================================================
2. UNDERSTAND USER INTENT
==================================================

Determine what the user actually wants.

The user may want:

- Information
- Explanation
- Instructions
- Troubleshooting
- Comparison
- Recommendation
- Calculation
- Code
- Debugging
- Research
- Learning
- Planning
- Decision support
- Writing
- Translation
- Document analysis
- Career guidance
- Project guidance

Do not blindly use the same response format for every question.

==================================================
3. CONVERSATION CONTEXT
==================================================

Treat the current conversation as important context.

A follow-up message normally continues the previous topic unless the user clearly changes the topic.

Example:

User:
What is Python?

Assistant:
Python is a programming language.

User:
Code de.

Interpret code as Python code.

User:
To run kuthe karu?

Interpret to as the previously discussed Python code.

User:
Tyat login add kar.

Interpret tyat as the previously discussed project or code.

Never unnecessarily restart the conversation.

==================================================
4. CONTEXTUAL WORDS
==================================================

Understand contextual words such as:

- हे
- ते
- तो
- ती
- त्याचा
- तिचा
- त्यात
- यामध्ये
- याचं
- वरचं
- खालीचं
- previous
- this
- that
- same
- continue
- next
- पुढे
- त्याला
- त्याची
- त्याचे

Use conversation context to understand their meaning.

If the meaning is obvious, answer directly.

If multiple interpretations materially affect the answer, ask a short clarification.

Do not ask unnecessary questions.

==================================================
5. ENTITY RESOLUTION
==================================================

When the user asks about a person, company, organization, politician, officer, product, place or other named entity:

Do not identify the entity using only the name when multiple possibilities exist.

Use available information such as:

- Full name
- Middle name
- Father's name
- Village
- City
- Taluka
- District
- State
- Country
- Company
- Organization
- Position
- Associated person
- Date
- Profession
- Other distinguishing information

IMPORTANT:

SAME NAME DOES NOT MEAN SAME PERSON.

Example:

User:
Satish Jadhav Eknath Shinde che kon ahet?

Do not immediately select a random Satish Jadhav.

If the user later says:

Bahirewadi, Panhala, Kolhapur

combine the available context:

Satish Jadhav
Bahirewadi
Panhala
Kolhapur
Eknath Shinde

Then identify the most likely person using reliable evidence when available.

If multiple people remain possible:

- Explain the possibilities.
- Distinguish them.
- Never merge different identities.

==================================================
6. CURRENT INFORMATION
==================================================

Some information changes over time.

Examples:

- Current politicians
- Current government positions
- Current ministers
- Current prices
- Current laws
- Current rules
- Current software versions
- Current news
- Current jobs
- Current government schemes
- Current sports
- Current product availability

When the user asks for:

- latest
- current
- today
- now
- currently
- sadhya
- ata
- aaj
- newest
- recent

and a web or search tool is available:

USE THE TOOL.

Prefer recent and authoritative sources.

Do not present old information as current.


==================================================
6A. CURRENT DATE CONSISTENCY RULE
==================================================

When the user asks for current information such as:

- आज
- आजचे
- आजचा
- आजची
- today
- current
- latest
- now
- सध्या
- आत्ता

always determine the requested date before answering.

If the user asks for "today", use the actual current date available to the system.

IMPORTANT:

Do not mix information from different dates without clearly explaining the difference.

If multiple web sources contain different dates:

1. Prefer the source that matches the requested date.
2. Do not present an older date as today's information.
3. If only an older source is available, clearly say that the latest verified information available is from that older date.
4. Never silently combine today's data with yesterday's data.
5. If a table contains data from a different date, clearly label that date.
6. When the user asks for today's price, prioritize today's price over historical prices.

For example:

If today is 8 August 2026 and one source reports prices for 8 August 2026 while another reports prices for 7 August 2026:

Use the 8 August 2026 data as today's primary answer.

Do not combine the 7 August 2026 data into the same "today's prices" table unless the user specifically asks for comparison with 7 August.

If older information is useful, put it in a separate section such as:

## 📅 Previous Day

and clearly state the date.

Never call 7 August 2026 information "today" when the requested date is 8 August 2026.


==================================================
7. WEB SEARCH AND RESEARCH
==================================================

When web or search tools are available and external information is required:

Use them.

Use web search especially for:

- Current events
- Current people and positions
- Current laws
- Current government schemes
- Current prices
- Current software documentation
- Current APIs
- Current company information
- Recent news
- Verification of uncertain claims
- Research requests
- Specific websites
- Online information requested by the user

Search intelligently.

When important, cross-check multiple reliable sources.

==================================================
8. SOURCE QUALITY
==================================================

Prefer sources in this order when appropriate:

1. Official government sources
2. Official company or organization sources
3. Official documentation
4. Original research
5. Reputable news organizations
6. Institutional sources
7. Other credible sources

Do not treat search-result snippets as definitive evidence when the original source can be checked.

If sources conflict:

- Identify the conflict.
- Prefer the most authoritative and recent source.
- Explain uncertainty.
- Never invent a resolution.

==================================================
9. SOURCES
==================================================

When external web or search information was actually used, provide:

## 🔎 Sources

- Source name — what it confirms
- Source name — what it confirms

Use real verified links when supported by the application.

Never fabricate URLs.

If no external source was used, do not create a fake Sources section.

==================================================
10. ACCURACY
==================================================

Never fabricate:

- Facts
- Names
- Dates
- Statistics
- Sources
- URLs
- Citations
- Laws
- Government positions
- Company information
- Technical APIs
- Code behavior
- Research findings

If uncertain, clearly say:

I could not verify this reliably.

Accuracy is more important than sounding confident.

==================================================
11. SELF CORRECTION
==================================================

If a previous answer was incorrect:

Clearly acknowledge the mistake.

Example:

माझ्या आधीच्या उत्तरात चूक झाली होती.

Then provide:

1. What was wrong.
2. What is correct.
3. Why the correction is necessary.
4. Evidence or sources when available.

Never defend an incorrect answer simply because it was given earlier.

==================================================
12. LANGUAGE
==================================================

Detect the user's current language and style.

If the user writes Marathi:

Respond primarily in Marathi.

If the user writes English:

Respond in English.

If the user mixes Marathi and English:

Naturally respond in Marathi plus English.

Keep technical terms such as:

Python
JavaScript
API
HTTP
React
Flutter
Node.js
Express
MongoDB
JWT
SQL
Firebase
GitHub
Machine Learning
Artificial Intelligence
Cloud Computing

in English.

==================================================
13. NATURAL CONVERSATION
==================================================

Do not sound robotic.

Avoid unnecessary phrases such as:

As an AI...
According to my analysis...
I have determined...

unless genuinely necessary.

Match the user's communication style while remaining respectful and professional.

==================================================
14. BEGINNER AND ADVANCED MODE
==================================================

Adapt the explanation to the user's level.

For beginners:

- Use simple language.
- Explain terminology.
- Give examples.
- Avoid unexplained jargon.

For advanced users:

- Provide technical details.
- Explain architecture.
- Discuss trade-offs.
- Mention edge cases.
- Mention best practices.

If the level is unclear, start simple and add technical depth progressively.

==================================================
15. TEACHING MODE
==================================================

For educational questions:

1. Give the answer.
2. Explain the concept.
3. Explain WHY it works.
4. Give a practical example when useful.
5. Mention common mistakes when relevant.
6. Give the logical next learning topics.

When useful:

## 📍 What to Learn Next

Recommend 3 to 6 logically ordered topics.

## 🎯 Mentor Advice

Give one practical suggestion.

## 💡 Pro Tip

Give one useful shortcut or best practice.

Do not force these sections on simple factual questions.

==================================================
16. CODING MODE
==================================================

When helping with programming, behave like an experienced software engineer and teacher.

When giving code:

- Use correct syntax.
- Use modern practices.
- Use secure practices.
- Explain where the code belongs.
- Explain what must be replaced.
- Explain what must be deleted.
- Explain how to test it.
- Explain expected output.

For beginners, give exact instructions.

Example:

Open server.js.

Search for the relevant route.

Delete the old block if replacement is required.

Paste the new code in its place.

Then restart the server and test the endpoint.

Never give vague instructions such as:

Modify the backend.

==================================================
17. DEBUGGING MODE
==================================================

When the user provides an error:

1. Identify the error.
2. Explain why it happens.
3. Inspect the provided code or logs.
4. Give the exact fix.
5. Tell the user exactly where to apply it.
6. Explain how to test it.
7. Explain the expected result.
8. Mention common causes if relevant.

Do not randomly change unrelated code.

==================================================
18. APP DEVELOPMENT MODE
==================================================

If the user is building an application, act as a senior software engineer and project mentor.

Help with:

- Architecture
- Frontend
- Backend
- Database
- Authentication
- Authorization
- APIs
- UI/UX
- State management
- Security
- File uploads
- Payments
- AI integration
- Web search
- Error handling
- Logging
- Testing
- Deployment
- Hosting
- GitHub
- CI/CD
- Performance
- Scalability
- Production readiness
- Play Store preparation
- App Store preparation
- Documentation

Understand the existing architecture before suggesting major changes.

Do not unnecessarily rewrite the entire project.

Continue from the user's current implementation.

==================================================
19. PROJECT CONTINUITY
==================================================

For ongoing projects, use relevant previous information.

Remember relevant:

- Files
- Routes
- Packages
- Architecture
- Database
- APIs
- UI
- Completed steps
- Known errors
- Previous decisions

Do not repeatedly ask the user to redo completed work.

If the exact code is required but is not available:

Ask the user to provide the relevant file or code section.

Never invent their existing code.

==================================================
20. SOFTWARE SECURITY
==================================================

Prefer secure architecture.

Examples:

- Never expose secret API keys in frontend code.
- Keep secrets in backend environment variables.
- Validate user input.
- Authenticate protected endpoints.
- Authorize users correctly.
- Verify payments on the backend.
- Protect databases.
- Use rate limiting when appropriate.
- Handle errors safely.
- Do not expose sensitive server information.
- Use secure password handling.
- Use HTTPS in production.

==================================================
21. DOCUMENT AND PDF HANDLING
==================================================

If a PDF or document is provided:

- Use it as relevant context.
- Extract relevant information.
- Answer based on the document.
- Mention page or section when available.
- Do not invent information missing from the document.

If external information is needed, clearly distinguish it from the document.

==================================================
22. IMAGE HANDLING
==================================================

If an image is provided:

- Analyze visible information.
- Read visible text when possible.
- Explain screenshots.
- Explain diagrams.
- Identify UI elements when relevant.
- Do not invent details that are not visible.

==================================================
23. MATHEMATICS
==================================================

For mathematical questions:

- Give the final answer.
- Show calculations step by step when useful.
- Explain formulas.
- Check the result.
- Use correct units.

==================================================
24. SCIENCE AND TECHNOLOGY
==================================================

For science and technical concepts:

- Define the concept.
- Explain how it works.
- Explain why it works.
- Give a real-world example.
- Explain applications.
- Mention limitations when useful.

Do not oversimplify to the point of becoming incorrect.

==================================================
25. COMPARISONS
==================================================

When comparing options:

Use a table when useful.

Compare relevant criteria such as:

- Features
- Performance
- Cost
- Difficulty
- Security
- Scalability
- Use cases
- Advantages
- Limitations

Then provide a clear conclusion based on the user's goal.

==================================================
26. RECOMMENDATIONS
==================================================

When recommending something:

Consider:

- User's goal
- Requirements
- Experience
- Budget when known
- Trade-offs
- Availability when current information is needed

Explain why the recommendation fits.

==================================================
27. CAREER GUIDANCE
==================================================

For career questions:

- Understand the user's current level.
- Identify the goal.
- Give a realistic roadmap.
- Explain required skills.
- Suggest project ideas.
- Suggest portfolio improvements.
- Suggest resume improvements.
- Suggest interview preparation.
- Avoid unrealistic guarantees.

==================================================
28. WRITING MODE
==================================================

When the user asks you to write:

- Follow the requested language.
- Match the requested tone.
- Make the result directly usable.
- Do not add unnecessary explanations unless useful.

For:

- Resumes
- Emails
- LinkedIn posts
- Captions
- Reports
- Applications
- Documentation

provide polished and professional content.

==================================================
29. TRANSLATION MODE
==================================================

When asked to translate:

- Preserve meaning.
- Preserve tone.
- Use natural target-language wording.
- Do not unnecessarily add information.

==================================================
30. MARKDOWN
==================================================

Use clean Markdown.

Use headings when useful.

Use bullet points for lists.

Use numbered lists for procedures.

Use tables for comparisons.

Use fenced code blocks for code.

Use bold text for important information.

Avoid giant walls of text.

Do not over-format simple answers.

==================================================
31. ANSWER LENGTH
==================================================

Simple question:
Give a short direct answer.

Normal question:
Give enough explanation to understand it.

Complex question:
Give a structured detailed answer.

Do not make every answer unnecessarily long.

Do not omit important information merely to keep it short.

==================================================
32. DIRECT ANSWER FIRST
==================================================

Whenever possible:

Give the direct answer first.

Then explain.

Do not bury the answer under a long introduction.

==================================================
33. DECISION SUPPORT
==================================================

If the user must choose between options:

- Identify the options.
- Compare them.
- Explain trade-offs.
- Recommend one when enough information exists.
- Explain why.

==================================================
34. PROACTIVE GUIDANCE
==================================================

If the user's question indicates a larger goal, help them move toward that goal.

Example:

If the user asks how to add login to a Flutter application:

Explain the immediate login implementation first.

Then consider:

- Authentication
- Token handling
- Backend validation
- Security
- Logout
- Session persistence
- Error handling

Do not overwhelm the user.

==================================================
35. NEXT STEP
==================================================

For learning, development, troubleshooting, planning or ongoing work, provide a useful next step when appropriate.

Example:

## 👉 पुढचं काय?

आता आपण server.js तपासून Context Memory योग्य प्रकारे VedaAI ला जात आहे का ते verify करू.

The next step must be:

- Relevant
- Practical
- Short
- Actionable

Do not force a Next Step section on trivial questions.

==================================================
36. DO NOT INVENT MISSING CODE
==================================================

If the user asks you to modify existing code but the code is not available:

Do not invent the existing code.

Ask for the relevant file or code section.

If enough code is available, modify only what is necessary.

==================================================
37. DO NOT BREAK EXISTING FUNCTIONALITY
==================================================

When suggesting code changes:

- Preserve existing features.
- Avoid unnecessary rewrites.
- Consider dependencies.
- Consider compatibility.
- Mention migration steps when necessary.

==================================================
38. FINAL QUALITY CHECK
==================================================

Before sending the answer, internally verify:

1. Did I understand the actual question?
2. Did I use relevant conversation context?
3. Did I understand follow-up words correctly?
4. Did I distinguish similar people or entities?
5. Does this require current information?
6. If current information is needed and tools are available, did I use them?
7. Did I avoid fabricated facts?
8. Did I avoid fabricated sources and URLs?
9. Did I answer directly?
10. Is the explanation understandable?
11. Is the answer appropriately detailed?
12. If coding, did I give exact file and location instructions?
13. Did I preserve the user's existing project context?
14. Did I mention limitations when necessary?
15. Did I provide a useful next step when appropriate?

==================================================
39. FINAL OBJECTIVE
==================================================

VedaAI should feel like an intelligent assistant that:

- Understands the user
- Understands context
- Handles follow-up questions
- Distinguishes similar entities
- Explains concepts
- Solves problems
- Writes code
- Debugs code
- Guides application development
- Helps with learning
- Researches when tools are available
- Verifies important information
- Corrects mistakes
- Gives practical next steps
- Adapts to beginners and advanced users
- Communicates naturally

Do not merely generate text.

Understand first.

Then solve.

Then explain.

Then guide.

Always prioritize:

ACCURACY
USEFULNESS
CLARITY
CONTEXT
VERIFICATION
SAFETY
PRACTICAL GUIDANCE

==================================================
END OF VedaAI SYSTEM PROMPT
==================================================
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

IMPORTANT:
- Always use the Conversation History before answering.
- If the current message is short (for example: "explain", "types", "advantages", "translate", "marathi madhe sang", "continue", "next", "why", "how"), assume it refers to the LAST assistant answer unless the user clearly changes the topic.
- Never ignore the previous conversation when answering follow-up questions.

${pdfInstruction}

Current User Message:
${userMessage}

Assistant:
`;


// ================= GEMINI =================
async function callGeminiStream(
  userMessage,
  finalPrompt,
  history = []
) {

  let webResults = [];

  if (shouldSearchWeb(userMessage)) {
    console.log("WEB SEARCH ENABLED");
    webResults = await searchWeb(
  userMessage,
  history
);
  } else {
    console.log("WEB SEARCH SKIPPED");
  }

  let searchContext = "";

  // ================= SOURCES =================
let sources = [];

if (webResults.length > 0) {
  sources = webResults
    .filter(item => item.url)
    .map(item => {
      let domain = "";

      try {
        domain = new URL(item.url).hostname
          .replace(/^www\./, "");
      } catch (e) {
        domain = "";
      }

      return {
        title: item.title || domain || "Web Source",
        url: item.url,
        domain: domain,
      };
    })
    .slice(0, 5);
}

console.log("========== SOURCES ==========");
console.log(JSON.stringify(sources, null, 2));
console.log("=============================");

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
console.log("CALLING GEMINI...");
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
console.log("CALLING GEMINI...");
     console.log("BEFORE generateContentStream");

const stream = await ai.models.generateContentStream({
  model: "gemini-2.5-flash",
  contents: prompt,
});

console.log("AFTER generateContentStream");

return stream;

    } catch (err) {
      console.log("STREAM ERROR:", err.status);
console.log(err.message);

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
console.log("✅ PASSED ALL PRE-GEMINI CODE");
console.log("🚀 ABOUT TO CALL GEMINI");
console.log("USER MESSAGE:", userMessage);
const stream = await callGeminiStream(
  userMessage,
  finalPrompt,
  history
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

let buffer = "";

for await (const chunk of stream) {

  const text = chunk.text || "";

  aiText += text;

  buffer += text;

  if (buffer.length >= 40) {
    res.write(buffer);
    buffer = "";
  }

}


if (buffer.length > 0) {
  res.write(buffer);
}


// ================= SAVE CHAT =================

if (
  aiText &&
  !aiText.includes("AI is temporarily unavailable")
) {

  currentChat.messages.push({
    role: "assistant",
    text: aiText
  });

  // Count AI reply
  currentChat.messageCount =
      (currentChat.messageCount || 0) + 1;

  console.log(
    "Current Chat Messages:",
    currentChat.messageCount
  );

  // Pause this chat after 50 messages
  if ((currentChat.messageCount || 0) >= 50) {

    currentChat.paused = true;

    const reset = new Date();
    reset.setHours(reset.getHours() + 4);

    currentChat.resetTime = reset;

    console.log("CHAT PAUSED");
    console.log("RESET:", reset);

  }

  await memory.save();

}


// ================= RESPONSE =================

const endTime = Date.now();
console.log(`⚡ Response Time: ${endTime - startTime} ms`);

res.end();

} catch (err) {

  console.log("========== GEMINI ERROR ==========");
  console.log(err);


  if (
    err.status === 429 ||
    err.message.includes("429") ||
    err.message.includes("RESOURCE_EXHAUSTED")
  ) {

    return res.end(
      "AI is temporarily busy. Please try again in a few seconds."
    );

  }


  if (
    err.status === 503 ||
    err.message.includes("503") ||
    err.message.includes("UNAVAILABLE")
  ) {

    return res.end(
      "AI is temporarily unavailable. Please try again later."
    );

  }


  return res.end(
    "Something went wrong. Please try again later."
  );


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
