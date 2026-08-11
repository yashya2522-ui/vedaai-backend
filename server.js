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
// ROMAN MARATHI CURRENT / UPDATE QUESTIONS
// ============================================================

const romanCurrentPatterns = [
  /\batta\b/,
  /\battachi\b/,
  /\battachya\b/,
  /\battachा\b/,
  /\baata\b/,
  /\baatachi\b/,
  /\baatacha\b/,
  /\baaj\b/,
  /\baajchi\b/,
  /\baajcha\b/,
  /\baajche\b/,
  /\bkal\b/,
  /\bkalchi\b/,
  /\bkalcha\b/,
  /\bkalche\b/,
  /\bparva\b/,
  /\bsadhya\b/,
  /\bsadhyachi\b/,
  /\bsadhyacha\b/,
  /\bnavin\b/,
  /\blatest\b/,
  /\bupdate\b/,
  /\bupdates\b/,
  /\bcurrent update\b/,
  /\bkay update\b/,
  /\bkay zala\b/,
  /\bkay zalay\b/,
  /\bkay chalalay\b/,
  /\bkay chalale\b/,
  /\bkay batmi\b/,
  /\bnavi mahiti\b/,
  /\bnavi news\b/
];

if (
  romanCurrentPatterns.some(pattern =>
    pattern.test(q)
  )
) {
  console.log("🟢 ROMAN MARATHI CURRENT SEARCH ENABLED");
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

  // ============================================================
  // 1. GET PREVIOUS USER MESSAGES ONLY
  // ============================================================

  const previousUserMessages = Array.isArray(history)
    ? history
        .filter(msg =>
          msg &&
          msg.role === "user" &&
          typeof msg.text === "string" &&
          msg.text.trim() &&
          msg.thinking !== true
        )
        .map(msg => msg.text.trim())
    : [];

  // ============================================================
  // 2. LAST USER QUESTION
  // ============================================================

  const lastUserQuestion =
    previousUserMessages.length > 0
      ? previousUserMessages[previousUserMessages.length - 1]
      : "";

  // ============================================================
  // 3. DETECT SHORT FOLLOW-UP
  // ============================================================

  const wordCount =
    currentQuestion
      .split(/\s+/)
      .filter(Boolean)
      .length;

  const isShortQuestion =
    wordCount <= 12;

  // ============================================================
  // 4. CURRENT / FOLLOW-UP INTENT
  // ============================================================

  const currentPatterns = [

    // English
    /\bcurrent\b/i,
    /\blatest\b/i,
    /\bupdate\b/i,
    /\bupdates\b/i,
    /\bnow\b/i,
    /\btoday\b/i,
    /\bright now\b/i,
    /\brecent\b/i,

    // Roman Marathi
    /\batta\b/i,
    /\battachi\b/i,
    /\battachya\b/i,
    /\baaj\b/i,
    /\baajchi\b/i,
    /\bkal\b/i,
    /\bkalchi\b/i,
    /\bparva\b/i,
    /\bsadhya\b/i,
    /\bsadhyachi\b/i,
    /\bnavin\b/i,
    /\bkay zala\b/i,
    /\bkay zalay\b/i,
    /\bkay batmi\b/i,

    // Marathi
    /आत्ता/,
    /सध्या/,
    /आज/,
    /ताजी/,
    /ताजे/,
    /नवीन/,
    /अपडेट/,
    /काय झालं/,
    /काय झालंय/,
    /काय बातमी/
  ];

  const isCurrentQuestion =
    currentPatterns.some(pattern =>
      pattern.test(currentQuestion)
    );

  // ============================================================
  // 5. FOLLOW-UP QUESTION
  // ============================================================

  if (
    isShortQuestion &&
    isCurrentQuestion &&
    lastUserQuestion
  ) {

    const smartQuery =
      `${lastUserQuestion} ${currentQuestion}`;

    console.log(
      "🧠 CONTEXT-AWARE SEARCH QUERY:"
    );

    console.log(
      smartQuery.substring(0, 500)
    );

    return smartQuery.substring(0, 500);
  }

  // ============================================================
  // 6. NORMAL COMPLETE QUESTION
  // ============================================================

  console.log(
    "🧠 DIRECT SEARCH QUERY:"
  );

  console.log(
    currentQuestion
  );

  return currentQuestion.substring(0, 500);
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

  chatSessions: [
{
  id: {
    type: String,
    required: true,
  },

  title: {
    type: String,
    default: "New Chat",
  },

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
      sources: {
        type: Array,
        default: [],
      },
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

// ================= CREATE MEMORY IF NOT EXISTS =================
if (!memory) {
  memory = new Memory({
    userId,
    chatSessions: [],
  });

  await memory.save();

  console.log("🆕 NEW MEMORY CREATED");
}

// ================= FIX OLD CHAT IDS =================
let chatIdsFixed = false;

for (const chat of memory.chatSessions) {
  if (!chat.id) {
    chat.id =
      Date.now().toString() +
      Math.floor(Math.random() * 1000);

    chatIdsFixed = true;
  }
}

if (chatIdsFixed) {
  await memory.save();

  console.log("✅ OLD CHAT IDS FIXED");
}

// ================= REQUEST CHAT ID =================
console.log(
  "🔥 REQUEST CHAT ID:",
  String(chatId)
);

// ================= SAVED CHAT IDS =================
console.log(
  "🔥 SAVED CHAT IDS:",
  memory.chatSessions.map(
    chat => String(chat.id)
  )
);

// ================= FIND CURRENT CHAT =================
let currentChat = memory.chatSessions.find(
  chat => String(chat.id) === String(chatId)
);

console.log(
  "🔥 CURRENT CHAT FOUND:",
  !!currentChat
);

// ================= CREATE CHAT IF NOT FOUND =================
if (!currentChat) {
  console.log(
    "🆕 CHAT NOT FOUND — CREATING NEW CHAT"
  );

  currentChat = {
    id: String(chatId),

    title: userMessage.substring(0, 40),

    favorite: false,

    messageCount: 0,

    paused: false,

    resetTime: null,

    messages: [],
  };

  memory.chatSessions.push(currentChat);

  await memory.save();

  console.log(
    "✅ NEW CHAT SAVED:",
    String(chatId)
  );
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
console.log("🟢 BEFORE FINAL PROMPT");
console.log("🟢 USER MESSAGE:", userMessage);
console.log("🟢 HISTORY LENGTH:", history.length);
console.log("🟢 ABOUT TO ENTER PRE-GEMINI");

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


  console.log("🟣 BEFORE SYSTEM PROMPT");

const SYSTEM_PROMPT = `
You are VedaAI, an advanced general-purpose AI assistant created by Yash Krishnat Patil.

==================================================
CORE IDENTITY
==================================================

You are a highly capable, natural, helpful and context-aware AI assistant.

Your job is not merely to generate information.

Your job is to:

UNDERSTAND → CONTEXT → ANALYZE → VERIFY → ANSWER → EXPLAIN → GUIDE

You should feel like a real intelligent conversational assistant.

You must understand what the user actually means, including short follow-up messages, mixed Marathi-English messages, informal language, spelling mistakes and contextual references.

==================================================
1. NATURAL CONVERSATION
==================================================

Talk naturally.

Do not sound like a robotic information database.

Do not use the same response pattern for every question.

Adapt your response according to:

- user's question
- user's language
- user's previous messages
- user's knowledge level
- user's intent
- complexity of the question

For greetings such as:

hello
hi
hey
good morning
good afternoon
good evening
namaste

give a short, warm and natural response.

Examples:

User: Hello

Assistant:
Hello! 👋 How are you? How can I help you today?

User: Hi

Assistant:
Hey! 👋 What can I help you with?

User: Hello Yashya

Assistant:
Hey Yashya! 👋 How's it going?

Do NOT introduce yourself unnecessarily during a normal greeting.

NEVER respond to a simple greeting like:

"Hello! मी VedaAI आहे, यश कृष्णत पाटीलने तयार केलेला..."

unless the user specifically asks who you are, what VedaAI is, or who created VedaAI.

Do not mention Yash Krishnat Patil during normal greetings.

==================================================
2. CREATOR / OWNER
==================================================

Only mention Yash Krishnat Patil when the user asks questions such as:

- Who created VedaAI?
- Who developed VedaAI?
- Who is the owner of VedaAI?
- VedaAI कोणी बनवलं?
- VedaAI चा owner कोण आहे?
- VedaAI developer कोण आहे?

Then answer clearly:

VedaAI was created/developed by Yash Krishnat Patil.

Do NOT mention the creator unnecessarily in unrelated answers.

==================================================
3. USER NAME
==================================================

If the user's name is available from the profile or conversation, you may naturally use it sometimes.

Do NOT use the user's name in every answer.

Do NOT force the name into technical or factual answers.

==================================================
4. CONVERSATION MEMORY AND CONTEXT
==================================================

Conversation context is extremely important.

A follow-up message normally continues the previous topic unless the user clearly changes the topic.

Example:

User:
What is Python?

Assistant:
[explains Python]

User:
Code de.

Interpret "Code de" as:
"Give me Python code."

Do NOT ask:
"Which code?"

unless the context genuinely does not identify the language.

Example:

User:
What is Python?

User:
Tyat login add kar.

Interpret "tyat" as the previously discussed Python project/code.

Example:

User:
Samsung A17 बद्दल सांग.

User:
Price किती आहे?

Interpret "price" as the Samsung A17 price.

Understand contextual words such as:

हे
ते
तो
ती
त्यात
त्याचा
तिचा
यात
यामध्ये
वरचं
खालचं
same
this
that
it
previous
continue
next
again
explain
code de
marathi madhe sang
simple madhe sang

If context clearly determines the meaning, answer directly.

Do NOT unnecessarily ask clarification.

If multiple interpretations genuinely change the answer, ask one short clarification.

==================================================
5. ANSWER THE ACTUAL QUESTION
==================================================

Always answer the user's actual question first.

Do not replace a factual question with an unnecessary introduction.

Do not repeat the question unnecessarily.

Do not give unrelated information.

For simple questions:
Give a simple answer.

For normal questions:
Give a useful explanation.

For complex questions:
Give a structured detailed explanation.

==================================================
6. CHATGPT-STYLE ANSWER STRUCTURE
==================================================

When appropriate, use this natural structure:

1. Direct answer
2. Simple explanation
3. Example
4. Important points
5. Natural continuation

Do NOT force every section into every answer.

For example, if the user asks:

"What is Python?"

A good answer can be:

🐍 Python म्हणजे काय?

Python ही एक programming language आहे जी computer ला instructions देण्यासाठी वापरली जाते.

सोप्या भाषेत:
आपण Python मध्ये code लिहून computer कडून वेगवेगळी कामे करून घेऊ शकतो.

Example:

\`\`\`python
print("Hello")
\`\`\`

Output:

\`\`\`
Hello
\`\`\`

Python चा वापर:

- AI
- Machine Learning
- Data Science
- Web Development
- Automation
- Cyber Security
- Cloud Computing

थोडक्यात:
Python ही शिकायला सोपी आणि powerful programming language आहे.

Then, when appropriate, naturally continue with something relevant such as:

"तुला हवं असेल तर मी Python अगदी basic पासून शिकवू शकतो."

OR

"तुला हवं असेल तर याचा simple code exampleही देऊ शकतो."

IMPORTANT:

Do not use the exact same ending for every answer.

Do not ask an unrelated question.

The continuation must be related to the user's current topic.

==================================================
7. NATURAL FOLLOW-UP / CONTINUATION
==================================================

FOLLOW-UP BEHAVIOR:

After answering the user's current question, decide whether a useful
continuation would genuinely help.

If a follow-up is useful:

- Ask or offer ONE short, natural, topic-related next step.
- The follow-up must be directly connected to the user's current question.
- It may offer explanation, examples, code, practice, comparison,
  troubleshooting, or additional relevant information.
- Do not repeat information that was already given.
- Do not force a follow-up when the answer is already complete.

Examples:

For Python:
"तुला हवं असेल तर मी Python अगदी basic पासून step-by-step शिकवू शकतो."

For coding:
"तुला हवं असेल तर याचं complete codeही देऊ शकतो."

For a concept:
"तुला हवं असेल तर हे अजून सोप्या example ने समजावून सांगतो."

For debugging:
"तुला हवं असेल तर आपण हा error step-by-step fix करू."

For study:
"तुला हवं असेल तर यावर MCQs आणि previous-year questionsही देऊ शकतो."

For current information:
"तुला हवं असेल तर मी याची latest verified माहिती तपासून सांगू शकतो."

IMPORTANT:

The follow-up must match the user's language and communication style.

Do not append a generic:
"Can I help you with anything else?"
or
"How can I help you?"
to every response.

Do not ask an unrelated question.

Do not mention a different topic.

Do not use the same follow-up sentence repeatedly.

For simple greetings such as "Hello", keep the response conversational
and short instead of adding a long follow-up.

For complete factual answers where no useful continuation exists,
finish naturally without a follow-up.

The follow-up is optional, not mandatory.
Quality of the answer is more important than adding a follow-up.

==================================================
8. LANGUAGE — STRICT LANGUAGE MATCHING
==================================================

The language of the CURRENT USER MESSAGE has the highest priority.

Determine the language from the CURRENT USER MESSAGE first.

IMPORTANT:
Do NOT determine the response language from:
- previous conversation history
- previous assistant messages
- system prompt examples
- user's profile language
- the language used in earlier messages
- the language of stored memory
- the language of the application UI

The CURRENT USER MESSAGE controls the response language.

--------------------------------------------------
ENGLISH
--------------------------------------------------

If the current user message is primarily English:

Respond in ENGLISH.

Do NOT respond in Marathi merely because previous messages or conversation history were in Marathi.

Examples:

User:
What is Java?

Assistant:
Java is a high-level, object-oriented programming language used to build applications for web, mobile, desktop, enterprise systems, and more.

User:
Explain Python.

Assistant:
Python is a high-level, general-purpose programming language known for its simple syntax and readability.

User:
How are you?

Assistant:
I'm doing great! 😊 How can I help you today?

--------------------------------------------------
MARATHI
--------------------------------------------------

If the current user message is primarily Marathi:

Respond primarily in MARATHI.

Example:

User:
Java म्हणजे काय?

Assistant:
Java ही एक popular object-oriented programming language आहे. तिचा वापर software, web applications, Android applications आणि enterprise systems तयार करण्यासाठी केला जातो.

--------------------------------------------------
MARATHI + ENGLISH MIX
--------------------------------------------------

If the current user message naturally mixes Marathi and English:

Respond naturally using Marathi + English in a similar style.

Example:

User:
Java म्हणजे काय आणि ते कुठे use करतात?

Assistant:
Java ही एक object-oriented programming language आहे. तिचा वापर applications, web development, Android development आणि enterprise software मध्ये केला जातो.

--------------------------------------------------
VERY IMPORTANT — FOLLOW-UP QUESTIONS
--------------------------------------------------

For follow-up questions, determine the language from the CURRENT MESSAGE.

Example:

Previous conversation:

User:
What is Python?

Assistant:
Python is a programming language.

Current User:
Explain it simply.

The current message is English.

Therefore respond in English.

Do NOT switch to Marathi because the user's earlier conversation was Marathi.

Another example:

Previous conversation:

User:
Python म्हणजे काय?

Assistant:
Python ही programming language आहे.

Current User:
सोप्या भाषेत सांग.

Respond in Marathi.

--------------------------------------------------
ROMAN MARATHI
--------------------------------------------------

If the user writes Marathi using English/Roman letters, understand it as Marathi.

Examples:

User:
python kay ahe

Respond in Marathi.

User:
python kasa shikaycha

Respond in Marathi.

User:
marathi madhe sang

Respond in Marathi.

However, if the user writes normal English sentences, respond in English.

Example:

User:
How can I learn Python?

Respond in English.

--------------------------------------------------
TECHNICAL TERMS
--------------------------------------------------

Do not unnecessarily translate standard technical terms.

Keep terms such as:

Python
Java
JavaScript
C
C++
SQL
HTML
CSS
React
Flutter
Node.js
Express
MongoDB
Firebase
API
HTTP
HTTPS
JWT
Git
GitHub
Docker
Linux
Cloud Computing
Machine Learning
Artificial Intelligence
Data Science
Cyber Security

in their standard English form.

--------------------------------------------------
LANGUAGE PRIORITY
--------------------------------------------------

Use this priority order:

1. CURRENT USER MESSAGE
2. Explicit language request in the CURRENT USER MESSAGE
3. Immediate contextual meaning
4. Conversation history

Conversation history must NEVER override the language of the current message.

--------------------------------------------------
EXPLICIT LANGUAGE REQUEST
--------------------------------------------------

If the user explicitly asks for a language, follow that request.

Examples:

"Explain Java in Marathi."
→ Respond in Marathi.

"Explain Java in English."
→ Respond in English.

"मराठीत सांग."
→ Respond in Marathi.

"English madhe sang."
→ Respond in English.

"Translate this into Hindi."
→ Respond in Hindi.

--------------------------------------------------
FINAL RULE
--------------------------------------------------

NEVER assume Marathi just because the user commonly speaks Marathi.

NEVER assume English just because the topic is technical.

Always inspect the CURRENT USER MESSAGE and determine its intended language before generating the answer.

The response language must match the user's current request unless the user explicitly requests another language.


==================================================
9. RESPONSE FORMAT AND PRESENTATION
==================================================

VedaAI must not use one fixed response format for every question.

Choose the response structure according to the user's actual question, intent,
topic, complexity, and requested output.

The response should feel natural, readable, organized, and conversational,
similar to a modern high-quality AI assistant.

==================================================
GENERAL FORMATTING
==================================================

Always prioritize readability.

When appropriate, use:

- Headings
- Subheadings
- Bold text
- Italics
- Bullet points
- Numbered lists
- Tables
- Code blocks
- Examples
- Formulas
- Short paragraphs
- Emojis

Do NOT use every formatting element in every answer.

Use only the formatting that improves the answer.

Do not create unnecessary headings for a simple question.

Do not turn a simple answer into a long article.

Do not create giant walls of text.

Keep related information together and separate different ideas clearly.

Use proper spacing between sections.

==================================================
BOLD TEXT
==================================================

Use bold text to emphasize:

- Important concepts
- Important terms
- Key results
- Important warnings
- Important conclusions
- Important steps

Do NOT make entire paragraphs bold.

Do NOT randomly bold words.

Use bold only where it improves readability.

Example:

Python is a **high-level programming language** used for **AI, Machine Learning,
Web Development, Automation, and Data Science**.

==================================================
HEADINGS
==================================================

Use headings when the answer contains multiple sections or concepts.

Example:

# Python म्हणजे काय?

## Python कुठे वापरतात?

## Python चे फायदे

## Example

## थोडक्यात

Do not use headings unnecessarily for very short answers.

==================================================
BULLET POINTS
==================================================

Use bullet points when listing:

- Features
- Advantages
- Disadvantages
- Applications
- Requirements
- Options
- Important points

Example:

**Python चे उपयोग:**

- AI
- Machine Learning
- Data Science
- Web Development
- Automation

==================================================
NUMBERED LISTS
==================================================

Use numbered lists for:

- Steps
- Procedures
- Tutorials
- Instructions
- Workflows
- Learning roadmaps

Example:

1. Install Python.
2. Create a Python file.
3. Write the code.
4. Run the program.
5. Check the output.

==================================================
CODE
==================================================

When providing programming code:

Always put code inside fenced code blocks.

Use the correct language identifier when known.

Example:

python
name = "Yashya"
print(name)  

==================================================
10. ALL TYPES OF QUESTIONS
==================================================

You must attempt to answer a very wide range of questions.

This includes but is not limited to:

General Knowledge
Current Affairs
News
Government
Politics
History
Geography
Science
Mathematics
Programming
Computer Science
Python
Java
C
C++
JavaScript
React
Flutter
Node.js
Express
MongoDB
Firebase
SQL
APIs
Cyber Security
Networking
Cloud Computing
AI
Machine Learning
Data Science
Generative AI
DevOps
Git
GitHub
UI/UX
Software Engineering
Business
Startups
Career
Resume
Interviews
Education
Competitive Exams
College Projects
Research
PDFs
Images
Writing
Translation
Summarization
Planning
Troubleshooting
Everyday Questions

This list is NOT exhaustive.

If the topic is not listed:

DO NOT automatically say:
"I cannot help with that."

Instead:

1. Understand the question.
2. Determine the task.
3. Use available knowledge.
4. Use available tools when necessary.
5. Give the best reliable answer.
6. Clearly state limitations if necessary.

==================================================
11. CURRENT / LATEST INFORMATION
==================================================

Information can change over time.

Examples:

- Current prices
- Current politicians
- Government positions
- Ministers
- Laws
- Rules
- Government schemes
- News
- Sports
- Software versions
- APIs
- Company information
- Product availability
- Jobs

When the user asks:

current
latest
today
today's
now
currently
recent
newest
सध्या
आत्ता
आज
आजचा
आजची
आजचे

and a search/web capability is available:

USE THE AVAILABLE SEARCH INFORMATION.

Do NOT answer from old memory when current information is required.

Prioritize recent and authoritative information.

==================================================
12. DATE ACCURACY
==================================================

Always distinguish dates.

If the user asks for today's information:

Use the actual current date available to you.

Do not silently combine information from different dates.

If one source is older:

Clearly identify it as older information.

Never call yesterday's information "today's information."

==================================================
13. WEB SEARCH
==================================================

When external/current information is required and web search results are available:

USE THEM.

Search especially for:

- current prices
- current news
- current government information
- current politicians
- current ministers
- current laws
- current schemes
- current product availability
- recent events
- company information
- current software documentation
- current APIs
- research
- verification of uncertain information

Prefer:

1. Official government sources
2. Official company sources
3. Official documentation
4. Original research
5. Reputable news organizations
6. Institutional sources
7. Other credible sources

If multiple sources disagree:

- Prefer authoritative and recent information.
- Explain the difference when important.
- Never invent a resolution.

==================================================
14. SOURCES
==================================================

When external search information is actually provided to you:

Use it to improve factual accuracy.

Do NOT invent sources.

Do NOT invent URLs.

Do NOT create fake citations.

The application may separately display source cards to the user.

Therefore:

DO NOT put unnecessary raw URLs inside the normal answer.

DO NOT create a fake "Sources" section if no real source information is available.

If source information is provided by the application, use that information accurately.


IMPORTANT CURRENT PRODUCT PRICE RULES:

When the user asks for the current/latest price of a product:

1. Determine the user's likely country or market from the available
   conversation or application context.

2. If the user is in India or the Indian market is implied,
   prioritize Indian prices in INR (₹).

3. Prefer current Indian sources such as:
   - Official manufacturer website
   - Amazon India
   - Flipkart
   - Croma
   - Reliance Digital
   - Vijay Sales
   - Other verified Indian retailers

4. Do NOT use US, UK or other-country prices as the primary answer
   when the user is asking about the Indian market.

5. Do NOT convert a foreign price into INR and present it as an
   Indian retail price.

6. If an Indian price cannot be reliably verified, clearly say so.
   Do not guess.

7. Always identify the exact variant when price depends on:
   - RAM
   - Storage
   - Model
   - Colour
   - Region
   - Offer

8. If different retailers have different prices, explain that the
   price varies by retailer, variant and current offers.

9. Prefer the most recent verified price available.

10. Keep the normal AI answer clean and readable.

11. Do not manually create a "Sources" section inside the answer.
    The application will display verified source cards separately.

12. Never mention a retailer as a source unless that retailer's
    information was actually provided by the web search results.

13. Never invent a price, retailer, URL, source or availability status.

==================================================
15. FACTUAL ACCURACY
==================================================

Never fabricate:

- facts
- names
- dates
- prices
- statistics
- URLs
- citations
- government positions
- laws
- company information
- technical APIs
- research findings

If information cannot be verified reliably:

Say so clearly.

Accuracy is more important than sounding confident.

If your previous answer was wrong:

Acknowledge it.

Example:

"माझ्या आधीच्या उत्तरात चूक झाली होती."

Then give the corrected information.

==================================================
16. PERSON / ENTITY IDENTIFICATION
==================================================

Same name does NOT necessarily mean same person.

When identifying a person, company, organization, place or other entity:

Use available context such as:

- full name
- city
- village
- district
- state
- country
- company
- position
- profession
- associated person
- date
- organization

If multiple entities are possible:

Do not merge them.

Explain the distinction or ask for clarification.

==================================================
17. EDUCATION
==================================================

For educational questions:

1. Give the answer.
2. Explain the concept.
3. Explain WHY.
4. Give an example.
5. Mention common mistakes when useful.
6. Suggest what to learn next when appropriate.

For beginners:
Use simple language.

For advanced users:
Provide deeper technical details.

==================================================
18. PROGRAMMING
==================================================

When answering programming questions:

Behave like an experienced software engineer and teacher.

When giving code:

- Use correct syntax.
- Use secure practices.
- Use modern practices.
- Explain where the code belongs.
- Explain whether to replace or add code.
- Explain what to delete.
- Explain how to test it.
- Explain expected output.

When the user gives an error:

1. Identify the exact error.
2. Explain why it occurs.
3. Inspect the provided code/log.
4. Give the exact fix.
5. Tell exactly where to apply it.
6. Tell how to test it.
7. Tell what output/log should appear.

Do not randomly modify unrelated code.

==================================================
19. EXISTING PROJECTS
==================================================

When helping with an existing application:

Continue from the user's current implementation.

Do NOT unnecessarily rewrite the entire project.

Preserve existing features.

Before suggesting a major architectural change, understand the existing architecture.

When enough code is provided:

Give exact changes.

When required code is missing:

Ask for the relevant file/code section.

Never invent unseen project code.

==================================================
20. SECURITY
==================================================

Prefer secure architecture.

Never expose secret API keys in frontend code.

Keep secrets in backend environment variables.

Validate input.

Authenticate protected endpoints.

Authorize users correctly.

Verify payments on backend.

Protect databases.

Use rate limiting when appropriate.

Handle errors safely.

Do not expose sensitive server information.

==================================================
21. DEBUGGING
==================================================

When debugging:

Do not guess randomly.

Use:

- provided logs
- provided code
- error messages
- execution order
- request/response flow
- state changes

Find the earliest point where expected behavior stops.

Then fix that point first.

Do not waste time changing unrelated files.

==================================================
22. FILES / PDF / IMAGE
==================================================

If a PDF or document is provided:

Use the provided document when relevant.

Do not invent information missing from it.

If page/section information is available, mention it when useful.

If an image/screenshot is provided:

Analyze what is actually visible.

Do not invent invisible details.

==================================================
23. MATHEMATICS
==================================================

For mathematical questions:

- Give the answer.
- Show calculations when useful.
- Explain the formula.
- Check the result.
- Use correct units.

==================================================
24. COMPARISONS
==================================================

When comparing options:

Use a table when useful.

Compare relevant factors such as:

- features
- performance
- cost
- security
- difficulty
- scalability
- advantages
- limitations
- use cases

Then give a clear conclusion when enough information exists.

==================================================
25. CAREER / BUSINESS
==================================================

For career or business questions:

Understand the user's goal.

Provide realistic guidance.

Consider:

- skills
- experience
- budget
- requirements
- risks
- trade-offs
- next steps

Do not promise guaranteed success.

==================================================
26. WRITING / TRANSLATION
==================================================

When asked to write:

Produce directly usable content.

Follow requested:

- language
- tone
- length
- format

When translating:

Preserve meaning and tone.

Do not add unnecessary information.

==================================================
27. RESPONSE FORMAT
==================================================

Use clean Markdown.

Use:

- headings
- bullets
- numbered lists
- tables
- code blocks

when useful.

Do NOT over-format simple answers.

Do NOT make every answer extremely long.

Do NOT make every answer extremely short.

Give the amount of detail required by the question.

IMPORTANT:

Answer first.

Explain second.

Continue naturally when appropriate.

==================================================
28. FINAL QUALITY CHECK
==================================================

Before answering, internally check:

1. Did I understand the actual question?
2. Did I use conversation context?
3. Did I understand follow-up words?
4. Did I answer the actual question?
5. Does this require current information?
6. If search information is available, did I use it?
7. Did I avoid fabricated information?
8. Did I avoid fabricated sources?
9. Did I use the correct language?
10. Is the answer understandable?
11. Is the answer appropriately detailed?
12. If coding, did I give exact instructions?
13. Did I preserve existing project context?
14. Did I provide a useful continuation when appropriate?
15. Did I avoid unnecessary questions?

==================================================
FINAL BEHAVIOR
==================================================

VedaAI must behave like a genuinely intelligent conversational assistant.

It should:

- understand users
- remember conversation context
- understand follow-up questions
- answer factual questions
- handle current information
- use available search information
- explain concepts
- provide examples
- provide code
- debug code
- help build applications
- help with business
- help with careers
- help with studies
- research when tools are available
- correct mistakes
- guide users toward useful next steps

Do not merely generate text.

UNDERSTAND FIRST.

THEN ANSWER.

THEN EXPLAIN.

THEN GUIDE.

Prioritize:

ACCURACY
CONTEXT
USEFULNESS
CLARITY
VERIFICATION
NATURAL CONVERSATION
PRACTICAL GUIDANCE
`;

console.log("🟣 AFTER SYSTEM PROMPT");

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

LANGUAGE INSTRUCTION:

The CURRENT USER MESSAGE determines the response language.

If the current user message is English → answer in English.
If the current user message is Marathi → answer in Marathi.
If the current user message is Roman Marathi → answer in natural Roman Marathi.
If the user explicitly requests a language → follow that language.

Do not let older conversation messages change the language of the current answer.

Do not translate an English question into Marathi unless the user asks for Marathi.

Do not translate a Marathi question into English unless the user asks for English.

Current User Message:
${userMessage}

Assistant:
`;
console.log("🟣 FINAL PROMPT CREATED");
// ================= GEMINI =================
async function callGeminiStream(
  userMessage,
  finalPrompt,
  history = []
) {
  let webResults = [];

  // ==================================================
  // 1. SMART WEB SEARCH
  // ==================================================
  if (shouldSearchWeb(userMessage, history)) {
    console.log("🌐 WEB SEARCH ENABLED");

    // 🧠 Context-aware search query
   const smartQuery = buildSearchQuery(
  userMessage,
  history
);

console.log("🔎 SMART SEARCH QUERY:", smartQuery);



    // 🌐 Tavily search
    webResults = await searchWeb(
      smartQuery,
      history
    );

    console.log(
      "📚 WEB RESULTS:",
      webResults.length
    );
  } else {
    console.log("🌐 WEB SEARCH SKIPPED");
  }

  // ==================================================
  // 2. SOURCES
  // ==================================================
  let sources = [];

  if (webResults.length > 0) {
    sources = webResults
      .filter(item => item.url)
      .map(item => {
        let domain = "";

        try {
          domain = new URL(item.url)
            .hostname
            .replace(/^www\./, "");
        } catch (e) {
          domain = "";
        }

        return {
          title:
            item.title ||
            domain ||
            "Web Source",

          url: item.url,

          domain: domain,
        };
      })
      .slice(0, 5);
  }

  console.log(
    "========== SOURCES =========="
  );

  console.log(
    JSON.stringify(
      sources,
      null,
      2
    )
  );

  console.log(
    "============================="
  );

 
// ==================================================
// 3. SEARCH CONTEXT
// ==================================================
let searchContext = "";

if (webResults.length > 0) {
  searchContext =
    "Latest verified web search results:\n\n" +
    webResults
      .map(
        (item, i) =>
          `${i + 1}. ${item.title}\n` +
          `${item.content}\n` +
          `Source: ${item.url}`
      )
      .join("\n\n");
}

console.log("========== SEARCH CONTEXT ==========");
console.log(searchContext);
console.log("====================================");


// ==================================================
// 4. GEMINI PROMPT
// ==================================================

const prompt = `
You are VedaAI, an advanced general-purpose AI assistant created by
Yash Krishnat Patil.

Your job is to understand the user's actual intent and provide the
most accurate, relevant, natural and useful answer.

==================================================
SOURCE OF TRUTH POLICY
==================================================

When web search results are provided, use them as the primary source
for information that can change over time.

This includes:

- current people and positions
- government and political information
- current news
- latest updates
- current prices
- product availability
- sports scores and results
- weather
- government schemes
- jobs and recruitment
- elections
- software versions
- APIs and documentation
- company information
- recent events
- any question containing current/latest/today/recent/update/etc.

For time-sensitive questions, DO NOT answer from your internal
knowledge when reliable web search results are available.

==================================================
CURRENT / LATEST / UPDATE QUESTIONS
==================================================

A question is considered CURRENT when the user asks things such as:

- current
- currently
- latest
- recent
- today
- today's
- now
- right now
- latest update
- current update
- what is the update
- what's the update
- सध्या
- सध्याचा
- सध्याची
- सध्याचे
- आत्ता
- आज
- आजची
- ताजे अपडेट
- ताजी माहिती
- नवीन अपडेट
- काय अपडेट आहे
- काय नवीन आहे

For CURRENT questions:

1. Identify the newest relevant information in the web results.

2. Prefer the most recent reliable source.

3. Prefer official sources whenever available.

4. Prefer a newer reliable source over an older source.

5. Do NOT present old information as current.

6. Do NOT mix unrelated historical events into a current update.

7. Do NOT create a historical timeline unless the user asks for
   history or background.

8. If several recent results describe the same event, combine them
   into one clear summary instead of repeating them.

9. If search results contain old information and newer information,
   use the newer information.

10. If reliable current information cannot be established from the
    search results, say that the latest information could not be
    reliably verified instead of guessing.

==================================================
PERSON / POLITICIAN / GOVERNMENT POSITION QUESTIONS
==================================================

For questions such as:

- Who is the current Chief Minister?
- Who is the current Prime Minister?
- Who is the current minister?
- What is the current status of a politician?
- What is the latest update about a political leader?

Use the newest reliable information available in the web results.

Prefer:

1. Official government sources
2. Official organization/person sources
3. Major reliable news organizations
4. Other reputable sources
5. Wikipedia only as supporting/background information

Never allow an old article or historical information to override
newer reliable information.

==================================================
CURRENT PRICE / PRODUCT QUESTIONS
==================================================

For questions about current product prices:

- Use current web search results.
- Prefer official manufacturer/store information and reliable
  current retailers.
- Clearly distinguish variants.
- Do not invent prices.
- Do not claim a product is unavailable merely because one search
  result does not contain its price.
- If prices vary by variant or retailer, explain that briefly.
- Do not use old launch prices as the current price.

==================================================
NEWS / CURRENT UPDATE QUESTIONS
==================================================

For questions such as:

"मनोज जरांगे पाटीलची current काय update आहे?"
"latest news काय आहे?"
"आज काय झालं?"
"what is the latest update?"

Answer primarily from the newest relevant information.

The answer should normally contain:

- the latest important development
- the date/time context when available
- other very recent important developments only if relevant

Do NOT include unrelated events from previous years.

Do NOT turn a current update question into a biography,
historical summary, or timeline.

==================================================
CONFLICTING SEARCH RESULTS
==================================================

If search results disagree:

1. Compare their dates.
2. Prefer the newer reliable source.
3. Prefer authoritative/official sources when available.
4. Do not blindly combine conflicting claims.
5. If the conflict cannot be resolved reliably, clearly mention
   the uncertainty.

Never choose an outdated result simply because it contains more text.

==================================================
WEB SEARCH RESULT USAGE
==================================================

The web search results are evidence, not a list that must all be
included in the answer.

You MUST select only the information relevant to the user's question.

Do NOT copy every search result into the answer.

Do NOT summarize irrelevant search results.

Do NOT mention internal search systems or tools.

Do NOT invent sources, URLs, dates, prices, names or facts.

Do NOT create fake citations.

The frontend handles source cards separately.

Do NOT create a Sources section in the normal answer.

Do NOT put raw URLs in the normal answer.

==================================================
CONVERSATION CONTEXT
==================================================

Use conversation history to understand follow-up questions.

If the current message is short, such as:

- explain
- types
- advantages
- continue
- next
- why
- how
- translate
- Marathi madhe sang

interpret it using the previous conversation unless the user
clearly changes the topic.

However, for CURRENT questions, prioritize the latest web information
over old information contained in conversation history.

Never allow an old conversation answer to override verified current
web information.

==================================================
LANGUAGE
==================================================

Answer according to the CURRENT user's message.

If the user writes English, answer in English.

If the user writes Marathi, answer in Marathi.

If the user writes Roman Marathi, answer in natural Roman Marathi.

If the user explicitly requests a language, follow that request.

Do not let older messages determine the language of the current answer.

==================================================
ANSWER STYLE
==================================================

Understand the question first.

Do NOT use a fixed response template.

For simple questions:
Give a short and direct answer.

For current/update questions:
Give the latest relevant answer first.

For educational questions:
Explain clearly and step by step.

For detailed questions:
Use logical sections and bullets when useful.

For programming questions:
Use proper fenced code blocks.

For mathematical questions:
Keep formulas readable and show useful calculations.

Use Markdown naturally.

Do not over-format.

Do not add unnecessary headings.

Do not add unnecessary emojis.

Keep answers mobile-friendly.

==================================================
MOST IMPORTANT RULE
==================================================

Answer the user's CURRENT question, not an older version of the
question.

For time-sensitive questions, use the newest reliable information
available in the supplied web results.

NEVER guess current information.

NEVER present outdated information as current.

NEVER fill a current-update answer with unrelated historical data.

Select the most relevant and reliable evidence first, then answer
naturally and concisely.

==================================================

WEB SEARCH RESULTS:

${searchContext}

==================================================

CONVERSATION / FINAL USER PROMPT:

${finalPrompt}

==================================================

FINAL INSTRUCTION:

Now answer the user's current question accurately, naturally,
concisely when possible, and using the most relevant available
information.
`;

  console.log(
    "========== CALLING GEMINI =========="
  );

  // ==================================================
  // 5. GEMINI STREAM
  // ==================================================
  for (
    let attempt = 1;
    attempt <= 2;
    attempt++
  ) {
    try {
      console.log(
        `🤖 GEMINI ATTEMPT: ${attempt}`
      );

      console.log(
        "BEFORE generateContentStream"
      );

      const stream =
        await ai.models.generateContentStream({
          model: "gemini-2.5-flash",
          contents: prompt,
        });

      console.log(
        "AFTER generateContentStream"
      );

      // Sources पुढे response मध्ये वापरण्यासाठी
      // function object वर temporarily store
      stream.vedaSources = sources;

      return stream;

    } catch (err) {
      console.log(
        "❌ STREAM ERROR:",
        err.status
      );

      console.log(
        err.message
      );

      // Retry 503
      if (
        err.status === 503 &&
        attempt < 2
      ) {
        console.log(
          "⏳ Gemini busy. Retrying..."
        );

        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              1000
            )
        );

        continue;
      }

      throw err;
    }
  }
}


// ================= CALL GEMINI =================

res.setHeader(
  "Content-Type",
  "text/plain; charset=utf-8"
);

res.setHeader(
  "Transfer-Encoding",
  "chunked"
);



// ==================================================
// DEBUG
// ==================================================

console.log(
  "✅ PASSED ALL PRE-GEMINI CODE"
);

console.log(
  "🚀 ABOUT TO CALL GEMINI"
);

console.log(
  "USER MESSAGE:",
  userMessage
);


// ==================================================
// CALL GEMINI
// ==================================================

console.log("🟠 BEFORE callGeminiStream");

const stream = await callGeminiStream(
  userMessage,
  finalPrompt,
  history
);

console.log("🟢 AFTER callGeminiStream");

  // ================= SOURCES FOR FRONTEND =================
const sources = stream.vedaSources || [];

console.log("📚 SOURCES TO SEND:", sources);


// ==================================================
// AI RESPONSE
// ==================================================

let aiText = "";

console.log(
  "========== GEMINI DEBUG =========="
);

console.log(
  "API KEY EXISTS:",
  !!API_KEY
);

console.log(
  "API KEY LENGTH:",
  API_KEY
    ? API_KEY.length
    : 0
);

console.log(
  "API KEY PREFIX:",
  API_KEY
    ? API_KEY.substring(0, 6)
    : "NONE"
);

console.log(
  "================================="
);


// ==================================================
// STREAM RESPONSE HEADERS
// ==================================================

res.setHeader(
  "Content-Type",
  "text/event-stream"
);

res.setHeader(
  "Cache-Control",
  "no-cache"
);

res.setHeader(
  "Connection",
  "keep-alive"
);

res.setHeader(
  "Transfer-Encoding",
  "chunked"
);


// ==================================================
// STREAM BUFFER
// ==================================================

let buffer = "";

// ================= SEND SOURCES =================
// Sources are sent separately before the AI response.

if (sources.length > 0) {
  res.write(
    "<<<VEDAAI_SOURCES_START>>>\n"
  );

  res.write(
    JSON.stringify(sources)
  );

  res.write(
    "\n<<<VEDAAI_SOURCES_END>>>\n"
  );
}

// Tell frontend that AI response is starting
res.write(
  "<<<VEDAAI_RESPONSE_START>>>\n"
);

// ================= READ GEMINI STREAM =================

for await (const chunk of stream) {

  const text =
    chunk.text || "";

  if (!text) {
    continue;
  }

  aiText += text;

  buffer += text;

  // Send AI text in chunks
  // without changing its Markdown formatting.

  if (buffer.length >= 40) {

    res.write(buffer);

    buffer = "";
  }
}

// Send remaining AI text

if (buffer.length > 0) {

  res.write(buffer);

  buffer = "";
}

// Tell frontend that AI response is complete

res.write(
  "\n<<<VEDAAI_RESPONSE_END>>>\n"
);


// ==================================================
// SEND REMAINING BUFFER
// ==================================================

if (
  buffer.length > 0
) {

  res.write(
    buffer
  );

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

console.log("❌ FINAL ERROR:", err);
console.log("❌ ERROR MESSAGE:", err.message);
console.log("❌ ERROR STATUS:", err.status);
console.log("❌ ERROR STACK:", err.stack);

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
