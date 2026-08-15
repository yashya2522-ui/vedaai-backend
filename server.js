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


// ==================================================
// SMART WEB SEARCH DECISION
// ==================================================

function shouldSearchWeb(query, history = []) {

  if (!query || typeof query !== "string") {
    return false;
  }

  const q = query.toLowerCase().trim();

  // ==================================================
  // 1. EXPLICIT SEARCH / VERIFICATION
  // ==================================================

  const explicitSearchPatterns = [
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

  if (
    explicitSearchPatterns.some(pattern =>
      q.includes(pattern)
    )
  ) {
    console.log("🌐 SEARCH REASON: EXPLICIT SEARCH");
    return true;
  }


  // ==================================================
  // 2. CURRENT / LATEST / RECENT
  // ==================================================

  const currentPatterns = [
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

  if (
    currentPatterns.some(pattern =>
      q.includes(pattern)
    )
  ) {
    console.log("🌐 SEARCH REASON: CURRENT/LATEST");
    return true;
  }


  // ==================================================
  // 3. CURRENT POSITION / OFFICE HOLDER
  // ==================================================

  const positionPatterns = [
    "who is the cm",
    "who is cm",
    "who is chief minister",
    "who is the chief minister",

    "who is the pm",
    "who is pm",
    "who is prime minister",
    "who is the prime minister",

    "who is the president",
    "who is president",

    "who is the governor",
    "who is governor",

    "who is the deputy cm",
    "who is deputy cm",
    "who is deputy chief minister",

    "who is the minister",
    "who is minister",

    "current cm",
    "current pm",
    "current president",
    "current governor",
    "current minister",
    "current ceo",

    "cm kon",
    "cm कोण",
    "मुख्यमंत्री कोण",
    "पंतप्रधान कोण",
    "राष्ट्रपती कोण",
    "राज्यपाल कोण",
    "मंत्री कोण",
    "उपमुख्यमंत्री कोण",

    "kon ahe",
    "kon aahe",
    "कोण आहे",
    "कोण आहेत"
  ];

  const positionWords = [
    "chief minister",
    "prime minister",
    "president",
    "governor",
    "minister",
    "deputy minister",
    "deputy cm",
    "deputy chief minister",
    "cm",
    "pm",
    "mla",
    "mp",
    "ceo",
    "chairman",
    "director",
    "mayor",

    "मुख्यमंत्री",
    "पंतप्रधान",
    "राष्ट्रपती",
    "राज्यपाल",
    "मंत्री",
    "उपमुख्यमंत्री",
    "आमदार",
    "खासदार",
    "महापौर"
  ];

  const asksWho =
    positionPatterns.some(pattern =>
      q.includes(pattern)
    );

  const containsPosition =
    positionWords.some(word =>
      q.includes(word)
    );

  if (asksWho && containsPosition) {
    console.log("🌐 SEARCH REASON: CURRENT POSITION/OFFICE HOLDER");
    return true;
  }


  // ==================================================
  // 4. PRICE / PRODUCT CURRENT INFORMATION
  // ==================================================

  const pricePatterns = [
    "price",
    "cost",
    "rate",
    "how much",
    "किंमत",
    "किंमती",
    "किती आहे",
    "कितीला",
    "भाव",
    "दर",

    "price sang",
    "price kiti",
    "price kay",
    "kiti price",
    "kiti la",
    "kiti rupaye",
    "rate kiti",
    "rate sang"
  ];

  const productPatterns = [
    "phone",
    "mobile",
    "smartphone",
    "laptop",
    "tv",
    "television",
    "watch",
    "tablet",
    "iphone",
    "samsung",
    "vivo",
    "oppo",
    "oneplus",
    "realme",
    "xiaomi",
    "redmi",
    "motorola",
    "pixel",
    "macbook",
    "airpods",
    "headphones",
    "camera",
    "gpu",
    "graphics card",
    "processor",
    "ssd",
    "ram",

    "मोबाईल",
    "फोन",
    "लॅपटॉप",
    "टीव्ही",
    "कॅमेरा"
  ];

  const asksPrice =
    pricePatterns.some(pattern =>
      q.includes(pattern)
    );

  const mentionsProduct =
    productPatterns.some(pattern =>
      q.includes(pattern)
    );

  if (asksPrice && mentionsProduct) {
    console.log("🌐 SEARCH REASON: PRODUCT PRICE");
    return true;
  }


  // ==================================================
  // 5. FINANCE / MARKET
  // ==================================================

  const financePatterns = [
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
    "usd inr",
    "forex",

    "सोन्याचा भाव",
    "सोन्याचा दर",
    "चांदीचा भाव",
    "चांदीचा दर",
    "शेअर भाव",
    "शेअर किंमत",
    "बाजारभाव",
    "डॉलरचा भाव"
  ];

  if (
    financePatterns.some(pattern =>
      q.includes(pattern)
    )
  ) {
    console.log("🌐 SEARCH REASON: FINANCE/MARKET");
    return true;
  }


  // ==================================================
  // 6. NEWS
  // ==================================================

  const newsPatterns = [
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
    "समाचार",

    "update",
    "updates",
    "update kay",
    "kay update",
    "काय अपडेट",
    "अपडेट काय"
  ];

  if (
    newsPatterns.some(pattern =>
      q.includes(pattern)
    )
  ) {
    console.log("🌐 SEARCH REASON: NEWS");
    return true;
  }


  // ==================================================
  // 7. SPORTS
  // ==================================================

  const sportsPatterns = [
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

  if (
    sportsPatterns.some(pattern =>
      q.includes(pattern)
    )
  ) {
    console.log("🌐 SEARCH REASON: SPORTS");
    return true;
  }


  // ==================================================
  // 8. WEATHER
  // ==================================================

  const weatherPatterns = [
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

  if (
    weatherPatterns.some(pattern =>
      q.includes(pattern)
    )
  ) {
    console.log("🌐 SEARCH REASON: WEATHER");
    return true;
  }


  // ==================================================
  // 9. GOVERNMENT / POLITICS / ELECTION
  // ==================================================

  const governmentPatterns = [
    "election",
    "government",
    "politician",
    "political party",
    "cabinet",
    "assembly election",
    "lok sabha election",
    "vidhan sabha",

    "निवडणूक",
    "सरकार",
    "राजकारणी",
    "राजकीय पक्ष",
    "मंत्रिमंडळ",
    "विधानसभा",
    "लोकसभा"
  ];

  if (
    governmentPatterns.some(pattern =>
      q.includes(pattern)
    )
  ) {
    console.log("🌐 SEARCH REASON: GOVERNMENT/POLITICS");
    return true;
  }


  // ==================================================
  // 10. GOVERNMENT SCHEMES / JOBS
  // ==================================================

  const schemePatterns = [
    "government scheme",
    "govt scheme",
    "new scheme",
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

  if (
    schemePatterns.some(pattern =>
      q.includes(pattern)
    )
  ) {
    console.log("🌐 SEARCH REASON: SCHEME/JOB");
    return true;
  }


  // ==================================================
  // 11. TECHNOLOGY CURRENT INFORMATION
  // ==================================================

  const technologyPatterns = [
    "latest version",
    "current version",
    "new version",
    "latest update",
    "new update",
    "release",
    "released",
    "documentation",
    "official documentation",
    "latest api",
    "new feature",
    "latest feature",
    "deprecated",

    "नवीन version",
    "नवीन अपडेट",
    "नवीन feature",
    "नवीन आवृत्ती"
  ];

  if (
    technologyPatterns.some(pattern =>
      q.includes(pattern)
    )
  ) {
    console.log("🌐 SEARCH REASON: TECHNOLOGY CURRENT");
    return true;
  }


  // ==================================================
  // 12. YEAR DETECTION
  // ==================================================

  if (
    /\b(2024|2025|2026|2027|2028|2029|2030)\b/.test(q)
  ) {
    console.log("🌐 SEARCH REASON: YEAR");
    return true;
  }


  // ==================================================
  // 13. PERSON / COMPANY RESEARCH
  // ==================================================

  const researchPatterns = [
    "who is",
    "who are",
    "information about",
    "information on",
    "details about",
    "details of",
    "profile of",
    "biography of",

    "कोण आहे",
    "कोण आहेत",
    "माहिती दे",
    "माहिती सांगा",
    "माहिती पाहिजे",
    "यांच्याबद्दल",
    "याच्याबद्दल"
  ];

  if (
    researchPatterns.some(pattern =>
      q.includes(pattern)
    )
  ) {
    console.log("🌐 SEARCH REASON: ENTITY RESEARCH");
    return true;
  }


  // ==================================================
  // 14. CONTEXT-BASED FOLLOW-UP
  // ==================================================

  if (Array.isArray(history) && history.length > 0) {

    const recentHistory = history
      .slice(-8)
      .map(msg => msg?.text || "")
      .join(" ")
      .toLowerCase();

    const contextTopics = [
      "price",
      "rate",
      "score",
      "match",
      "gold",
      "silver",
      "stock",
      "share",
      "weather",
      "news",
      "election",
      "minister",
      "government",
      "vivo",
      "samsung",
      "iphone",
      "oneplus",
      "phone",
      "laptop",

      "भाव",
      "दर",
      "स्कोअर",
      "सामना",
      "सोने",
      "चांदी",
      "हवामान",
      "बातमी",
      "निवडणूक",
      "मंत्री",
      "सरकार",
      "मोबाईल",
      "फोन",
      "लॅपटॉप"
    ];

    const followUpPatterns = [
      "price",
      "rate",
      "score",
      "result",
      "winner",
      "how much",
      "now",
      "latest",
      "update",

      "किती",
      "किती आहे",
      "आत्ता",
      "सध्या",
      "निकाल",
      "भाव",
      "दर",
      "अपडेट",
      "काय झालं",
      "काय झालंय"
    ];

    const isShortQuestion =
      q.split(/\s+/).filter(Boolean).length <= 12;

    const historyHasTopic =
      contextTopics.some(topic =>
        recentHistory.includes(topic)
      );

    const isFollowUp =
      followUpPatterns.some(pattern =>
        q.includes(pattern)
      );

    if (
      isShortQuestion &&
      historyHasTopic &&
      isFollowUp
    ) {
      console.log("🌐 SEARCH REASON: CONTEXT FOLLOW-UP");
      return true;
    }
  }

// ==================================================
// DEFAULT SMART SEARCH
// ==================================================

console.log("🧠 DEFAULT SMART SEARCH CHECK");

// If no specific rule matched above,
// allow web search for factual / informational questions.

const factualPatterns = [
  "what",
  "who",
  "where",
  "when",
  "which",
  "how much",
  "how many",
  "why",
  "information",
  "details",
  "price",
  "cost",
  "rate",
  "available",
  "available now",
  "is it true",
  "true or false",

  "काय",
  "कोण",
  "कुठे",
  "कधी",
  "किती",
  "किती आहे",
  "कितीला",
  "कसा",
  "कशी",
  "कसे",
  "का",
  "माहिती",
  "तपशील",
  "किंमत",
  "भाव",
  "दर",
  "उपलब्ध",
  "खरं आहे का",
  "खरे आहे का"
];

const looksFactual =
  factualPatterns.some(pattern =>
    q.includes(pattern)
  );

if (looksFactual) {
  console.log(
    "🌐 SEARCH REASON: GENERAL FACTUAL QUESTION"
  );

  return true;
}

console.log(
  "⚪ SEARCH NOT REQUIRED: GENERAL CHAT"
);

return false;
}

// ================= WEB CACHE =================
const webCache = new Map();

const CACHE_TIME = 0;


// ================= SMART SEARCH QUERY =================

function buildSearchQuery(query, history = []) {

  if (!query || typeof query !== "string") {
    return "";
  }

  const currentQuestion = query.trim();

  // ============================================================
  // PREVIOUS USER MESSAGES
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
  // NORMALIZE
  // ============================================================

  const normalizedCurrent =
    currentQuestion
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const lastUserQuestion =
    previousUserMessages.length > 0
      ? previousUserMessages[previousUserMessages.length - 1]
      : "";

  const normalizedLast =
    lastUserQuestion
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  // ============================================================
  // CURRENT / LATEST INTENT
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
    /\baajcha\b/i,
    /\bkal\b/i,
    /\bkalchi\b/i,
    /\bkalcha\b/i,
    /\bparva\b/i,
    /\bsadhya\b/i,
    /\bsadhyachi\b/i,
    /\bnavin\b/i,
    /\bkay zala\b/i,
    /\bkay zalay\b/i,
    /\bkay batmi\b/i,
    /\bkay news\b/i,

    // Marathi Unicode
    /आत्ता/u,
    /सध्या/u,
    /आज/u,
    /आजची/u,
    /आजचा/u,
    /काल/u,
    /कालची/u,
    /नवीन/u,
    /अपडेट/u,
    /अपडेट्स/u,
    /काय झालं/u,
    /काय झालंय/u,
    /काय झालाय/u,
    /काय बातमी/u,
    /सध्याची/u
  ];

  const hasExplicitCurrentIntent =
    currentPatterns.some(pattern =>
      pattern.test(normalizedCurrent)
    );

  // ============================================================
  // ENTITY + UPDATE INTENT
  //
  // IMPORTANT:
  // User does NOT have to type "today/latest".
  //
  // Example:
  // "Manoj Jarange Patil chi update kay ahe?"
  //
  // "update" itself means current information.
  // ============================================================

  const updateWords = [
    "update",
    "updates",
    "latest",
    "current",
    "recent",
    "news",
    "batmi",
    "बातमी",
    "अपडेट",
    "अपडेट्स",
    "नवीन",
    "सध्याची",
    "सध्याचे"
  ];

  const hasUpdateIntent =
    updateWords.some(word =>
      normalizedCurrent.includes(word)
    );

  // ============================================================
  // FOLLOW-UP INTENT
  // ============================================================

  const followUpPatterns = [
    /\bwhat about\b/i,
    /\bthen\b/i,
    /\band now\b/i,
    /\bmore\b/i,
    /\banything new\b/i,
    /\bwhat happened\b/i,

    /मग काय/u,
    /आता काय/u,
    /पुढे काय/u,
    /आणखी काय/u,
    /नवीन काय/u,
    /काय झालं/u,
    /काय झालंय/u
  ];

  const isFollowUp =
    followUpPatterns.some(pattern =>
      pattern.test(normalizedCurrent)
    );

  // ============================================================
  // SHORT QUESTION
  // ============================================================

  const wordCount =
    normalizedCurrent
      .split(/\s+/)
      .filter(Boolean)
      .length;

  const isShortQuestion = wordCount <= 12;

  // ============================================================
  // BUILD QUERY
  // ============================================================

  let searchQuery = currentQuestion;

  // ============================================================
  // CURRENT / UPDATE QUESTION
  // ============================================================

  if (hasExplicitCurrentIntent || hasUpdateIntent) {

    searchQuery =
      `${currentQuestion} latest current update today 2026`;

  }

  // ============================================================
  // FOLLOW-UP QUESTION
  // ============================================================

  else if (
    isFollowUp &&
    normalizedLast
  ) {

    searchQuery =
      `${lastUserQuestion} ${currentQuestion} latest current update 2026`;

  }

  // ============================================================
  // SHORT FOLLOW-UP
  // ============================================================

  else if (
    isShortQuestion &&
    normalizedLast &&
    !hasUpdateIntent
  ) {

    searchQuery =
      `${lastUserQuestion} ${currentQuestion}`;

  }

  // ============================================================
  // CLEAN QUERY
  // ============================================================

  return searchQuery
    .replace(/\s+/g, " ")
    .trim();
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

// ================= SMART WEB SEARCH =================
function extractDateFromUrl(url = "") {
  if (!url || typeof url !== "string") {
    return null;
  }

  const match = url.match(
    /\/(20\d{2})\/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\/(\d{1,2})\//i
  );

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;

  const months = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12"
  };

  const monthNumber = months[month.toLowerCase()];

  if (!monthNumber) {
    return null;
  }

  return `${year}-${monthNumber}-${String(day).padStart(2, "0")}`;
}

async function searchWeb(query, history = []) {
  try {
    if (!query || typeof query !== "string") {
      return [];
    }

   const searchQuery =
  `${query.trim()} latest current update today ${new Date().toLocaleDateString(
    "en-CA",
    { timeZone: "Asia/Kolkata" }
  )} India`;

    console.log("🌐 SEARCH WEB:", searchQuery);

    const response = await axios.post(
  "https://api.tavily.com/search",
  {
    api_key: process.env.TAVILY_API_KEY,
    query: searchQuery,

    search_depth: "advanced",
    topic: "news",

    max_results: 10,

    include_answer: false,
    include_raw_content: false,

    days: 14
  },
  {
    headers: {
      "Content-Type": "application/json"
    },
    timeout: 15000
  }
);

    let results = Array.isArray(response.data?.results)
      ? response.data.results
      : [];

    console.log("📚 TAVILY RESULTS:", results.length);

    // ==========================================
    // 📰 NEWS DATE NORMALIZATION
    // ==========================================

    results = results.map(item => {
      const url = item.url || "";

      const publishedDate =
        item.publishedDate ||
        item.published_date ||
        item.date ||
        extractDateFromUrl(url) ||
        null;

      return {
        title: item.title || "",
        content: item.content || "",
        url,
        publishedDate
      };
    });

    // ==========================================
    // 📅 REMOVE VERY OLD NEWS
    // ==========================================

    const now = new Date();

    const recentResults = results.filter(item => {
      if (!item.publishedDate) {
        return true;
      }

      const published = new Date(item.publishedDate);

      if (isNaN(published.getTime())) {
        return true;
      }

      const ageDays =
        (now.getTime() - published.getTime()) /
        (1000 * 60 * 60 * 24);

      // NEWS query साठी 30 दिवसांपेक्षा जुनी
      // बातमी मुख्य results मधून काढा
      return ageDays <= 30;
    });

    // ==========================================
    // 🆕 LATEST FIRST
    // ==========================================

    recentResults.sort((a, b) => {
      const dateA = new Date(a.publishedDate || 0).getTime();
      const dateB = new Date(b.publishedDate || 0).getTime();

      return dateB - dateA;
    });

    console.log(
      "📅 SORTED NEWS RESULTS:",
      recentResults.map(item => ({
        title: item.title,
        publishedDate: item.publishedDate,
        url: item.url
      }))
    );

    console.log(
      "🟢 LATEST NEWS:",
      recentResults[0]?.title || "No recent result"
    );

    return recentResults;

  } catch (error) {

    console.error(
      "❌ SEARCH WEB ERROR:",
      error.response?.data || error.message
    );

    return [];
  }
}
 

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
let webResults = [];
let smartQuery = "";

if (shouldSearchWeb(userMessage, history)) {

  // 🧠 Build the same smart query used for web search
  smartQuery = buildSearchQuery(
    userMessage,
    history
  );

  console.log(
    "🔎 SMART QUERY FOR RANKING:",
    smartQuery
  );

  webResults = await searchWeb(
    smartQuery,
    history
  );
}

console.log(
  "🌐 WEB SEARCH RESULTS:",
  webResults.length
);


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
let wikiText = "";
let newsText = "";

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
// SMART WEB RESULT RELEVANCE
// ==================================================
function normalizeSearchText(text = "") {
  if (!text || typeof text !== "string") {
    return "";
  }

  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getValidPublishedDate(item) {
  const possibleDates = [
    item.publishedDate,
    item.published_date,
    item.publishedAt,
    item.date,
    item.pubDate,
    extractDateFromUrl(item.url || "")
  ];

  for (const value of possibleDates) {
    if (!value) continue;

    const timestamp = new Date(value).getTime();

    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp);
    }
  }

  return null;
}
function getSearchRelevanceScore(item, query = "") {
  if (!item || !query) {
    return 0;
  }

  const title = normalizeSearchText(item.title || "");
  const content = normalizeSearchText(item.content || "");
  const url = normalizeSearchText(item.url || "");
  const q = normalizeSearchText(query);

  let score = 0;
   // ==================================================
// FRESHNESS / CURRENT UPDATE BOOST
// ==================================================

const currentIntent =
  /\b(latest|current|today|now|recent|update|updates|right now)\b/i.test(query) ||
  /\b(atta|attachi|attachya|aaj|aajchi|sadhya|sadhyachi|navin|kay zala|kay zalay|kay batmi)\b/i.test(query);

if (currentIntent) {

  const publishedDate = getValidPublishedDate(item);

  if (publishedDate) {

    const publishedTime = publishedDate.getTime();
    const now = Date.now();

    const ageDays =
      Math.max(
        0,
        (now - publishedTime) /
          (1000 * 60 * 60 * 24)
      );

    // 🔥 Very fresh
    if (ageDays <= 1) {
      score += 80;

    // 🟢 Last 3 days
    } else if (ageDays <= 3) {
      score += 60;

    // 🟡 Last 7 days
    } else if (ageDays <= 7) {
      score += 40;

    // 🟠 Last 14 days
    } else if (ageDays <= 14) {
      score += 20;

    // 🔵 Last 30 days
    } else if (ageDays <= 30) {
      score += 5;

    // 🔴 Older than 30 days
    } else {
      score -= 50;
    }

    console.log("📰 FRESHNESS:", {
      title: item.title,
      publishedDate: publishedDate.toISOString(),
      ageDays: Number(ageDays.toFixed(2)),
      freshnessScore: score
    });

  } else {
  score -= 10;

  console.log("⚠️ NO VALID DATE:", item.title);
}
}
  // ==================================================
  // QUERY WORDS
  // ==================================================

  const stopWords = new Set([
    "what", "who", "is", "the", "a", "an",
    "of", "in", "on", "for", "to", "and",
    "price", "cost", "rate",
    "kiti", "kay", "chi", "cha", "che",
    "ahe", "sang", "kon",
    "which", "latest", "current", "today",
     "india", "online"
  ]);

  const queryWords = q
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word =>
      word.length >= 2 &&
      !stopWords.has(word)
    );

  // ==================================================
  // ENTITY / PRODUCT MATCH
  // ==================================================

  const titleWords = title.split(/\s+/);

  const matchedQueryWords = queryWords.filter(word =>
    titleWords.includes(word)
  );

  if (
    queryWords.length > 0 &&
    matchedQueryWords.length === queryWords.length
  ) {
    score += 40;
  }

  const missingWords = queryWords.filter(word =>
    !titleWords.includes(word)
  );

  if (missingWords.length > 0) {
  score -= missingWords.length * 4;
}

  // ==================================================
  // QUERY MATCH
  // ==================================================

  for (const word of queryWords) {

    if (title.includes(word)) {
      score += 15;
    }

    if (content.includes(word)) {
      score += 4;
    }

    if (url.includes(word)) {
      score += 8;
    }
  }

  // ==================================================
  // EXACT ENTITY / PRODUCT MATCH
  // ==================================================

  const importantWords = queryWords.filter(
    word => word.length >= 3
  );

  if (
    importantWords.length > 0 &&
    importantWords.every(word =>
      title.includes(word)
    )
  ) {
    score += 30;
  }

  // ==================================================
  // CURRENT INFORMATION
  // ==================================================

  if (
    title.includes("2026") ||
    content.includes("2026") ||
    title.includes("latest") ||
    content.includes("latest") ||
    content.includes("current") ||
    content.includes("updated") ||
    content.includes("today")
  ) {
    score += 8;
  }

  // ==================================================
  // PRICE QUESTION
  // ==================================================

  const isPriceQuestion =
    q.includes("price") ||
    q.includes("cost") ||
    q.includes("rate") ||
    q.includes("kiti") ||
    q.includes("किंमत") ||
    q.includes("किती");

  if (isPriceQuestion) {

    // Price-related content
    if (
      content.includes("price") ||
      content.includes("₹") ||
      content.includes("rs.") ||
      content.includes("rs ") ||
      content.includes("inr")
    ) {
      score += 10;
    }

    // Current selling price
    if (
      content.includes("current price") ||
      content.includes("latest price") ||
      content.includes("selling price") ||
      content.includes("available at")
    ) {
      score += 15;
    }

    // Old / launch price should be weaker
    if (
      content.includes("launch price") ||
      content.includes("launched at") ||
      content.includes("original price")
    ) {
      score -= 8;
    }

    // ==================================================
    // OFFICIAL MANUFACTURER / STORE
    // ==================================================

    if (
      url.includes("vivo.com") ||
      url.includes("shop.vivo.com") ||
      url.includes("samsung.com") ||
      url.includes("apple.com") ||
      url.includes("mi.com") ||
      url.includes("motorola.in") ||
      url.includes("oneplus.in") ||
      url.includes("realme.com")
    ) {
      score += 35;
    }

    // ==================================================
    // MAJOR RETAILERS
    // ==================================================

    if (
      url.includes("amazon.in") ||
      url.includes("flipkart.com") ||
      url.includes("croma.com") ||
      url.includes("reliancedigital.in")
    ) {
      score += 20;
    }

    // Social/video should NOT dominate price answers
    if (
      url.includes("youtube.com") ||
      url.includes("facebook.com") ||
      url.includes("instagram.com")
    ) {
      score -= 25;
    }
  }

  // ==================================================
  // OFFICIAL / RELIABLE SOURCES
  // ==================================================

  const reliableDomains = [
    "samsung.com",
    "vivo.com",
    "apple.com",

    "gov.in",
    "maharashtra.gov.in",
    "india.gov.in",

    "abplive.com",
    "ndtv.com",
    "ndtvprofit.com",
    "indianexpress.com",
    "hindustantimes.com",
    "timesofindia.indiatimes.com",
    "thehindu.com",

    "gadgets360.com",
    "91mobiles.com",
    "gsmarena.com",
    "smartprix.com",
    "digit.in"
  ];

  for (const domain of reliableDomains) {

    if (url.includes(domain)) {
      score += 12;
      break;
    }
  }

  // ==================================================
  // WEAK SOURCE PENALTY
  // ==================================================

  const weakDomains = [
    "facebook.com",
    "instagram.com",
    "pinterest.com",
    "reddit.com"
  ];

  for (const domain of weakDomains) {

    if (url.includes(domain)) {
      score -= 15;
      break;
    }
  }

  return score;
}

function cleanUrl(url) {

  if (!url || typeof url !== "string") {
    return "";
  }

  const markdownMatch =
    url.match(/\((https?:\/\/[^)]+)\)/);

  if (markdownMatch) {
    return markdownMatch[1];
  }

  return url.trim();
}
function filterWebResults(results = [], query = "") {

  if (!Array.isArray(results)) {
    return [];
  }

  const now = Date.now();

  const currentWords = [
    "current",
    "latest",
    "today",
    "recent",
    "now",
    "update",
    "updates",
    "atta",
    "aaj",
    "aajchi",
    "sadhya",
    "navin",
    "kay zala",
    "kay zalay",
    "kay batmi"
  ];

  const normalizedQuery =
    normalizeSearchText(query);

  const wantsFresh =
    currentWords.some(word =>
      normalizedQuery.includes(word)
    );

  console.log("🧠 SMART QUERY:", query);
  console.log("🧹 NORMALIZED QUERY:", normalizedQuery);
  console.log("🆕 WANTS FRESH:", wantsFresh);


  return results

    // ==================================================
    // VALID RESULTS
    // ==================================================

    .filter(item =>
      item &&
      typeof item.title === "string" &&
      typeof item.content === "string" &&
      item.content.trim().length > 0 &&
      item.url
    )


    // ==================================================
    // SCORE RESULTS
    // ==================================================

    .map(item => {

      // ------------------------------
      // RELEVANCE
      // ------------------------------

      const relevanceScore =
        Number(
          getSearchRelevanceScore(
            item,
            query
          )
        ) || 0;


      // ------------------------------
      // DATE
      // ------------------------------

      const validPublishedDate =
        getValidPublishedDate(item);

      let publishedDate = null;
      let ageDays = 9999;
      let freshnessScore = 0;


      if (validPublishedDate) {

        publishedDate =
          validPublishedDate.toISOString();

        const publishedTime =
          validPublishedDate.getTime();

        ageDays =
          Math.max(
            0,
            (now - publishedTime) /
            (1000 * 60 * 60 * 24)
          );


        // ------------------------------
        // FRESHNESS
        // ------------------------------

        if (ageDays <= 1) {

          freshnessScore = 50;

        } else if (ageDays <= 3) {

          freshnessScore = 40;

        } else if (ageDays <= 7) {

          freshnessScore = 30;

        } else if (ageDays <= 14) {

          freshnessScore = 20;

        } else if (ageDays <= 30) {

          freshnessScore = 10;

        } else if (ageDays <= 60) {

          freshnessScore = 3;

        } else {

          freshnessScore = -20;
        }

      } else {

        freshnessScore = -10;

        console.log(
          "⚠️ NO VALID DATE:",
          item.title
        );
      }


      // ------------------------------
      // FINAL SCORE
      // ------------------------------

      const finalScore =
        wantsFresh
          ? (
              relevanceScore * 0.7 +
              freshnessScore * 3
            )
          : relevanceScore;


      // ------------------------------
      // DEBUG
      // ------------------------------

      console.log(
        "📊 RANKING:",
        {
          title: item.title,
          publishedDate,
          ageDays: Number(
            ageDays.toFixed(2)
          ),
          relevanceScore,
          freshnessScore,
          finalScore
        }
      );


      // ------------------------------
      // RETURN
      // ------------------------------

      return {

        ...item,

        publishedDate,

        _relevanceScore:
          relevanceScore,

        _freshnessScore:
          freshnessScore,

        _ageDays:
          ageDays,

        _finalScore:
          finalScore
      };

    })


    // ==================================================
    // SORT
    // ==================================================

    .sort((a, b) => {

      if (wantsFresh) {

        if (
          b._finalScore !==
          a._finalScore
        ) {

          return (
            b._finalScore -
            a._finalScore
          );
        }


        // Same score → newer first

        return (
          a._ageDays -
          b._ageDays
        );
      }


      // Normal query

      return (
        b._relevanceScore -
        a._relevanceScore
      );

    })


    // ==================================================
    // TOP 8
    // ==================================================

    .slice(0, 8);
}

// ==================================================
// RANK RESULTS
// ==================================================

const rankedWebResults =
  filterWebResults(
    webResults,
    smartQuery
  );

console.log(
  "========== RANKED WEB RESULTS =========="
);

rankedWebResults.forEach(
  (item, index) => {

    console.log(
  `${index + 1}.`,
  item.title,
  "| RELEVANCE:",
  item._relevanceScore,
  "| FRESHNESS:",
  item._freshnessScore,
  "| AGE DAYS:",
  item._ageDays,
  "| FINAL:",
  item._finalScore,
  "| DATE:",
  item.publishedDate,
  "| URL:",
  item.url
);

  }
);

console.log(
  "========================================="
);


// ==================================================
// SOURCES — USE RANKED RESULTS
// ==================================================
let sources = [];

if (
  Array.isArray(rankedWebResults) &&
  rankedWebResults.length > 0
) {

  sources =
    rankedWebResults
      .filter(item =>
        item &&
        item.url
      )
      .slice(0, 5)
      .map(item => {

        const cleanSourceUrl =
          cleanUrl(item.url);

        let domain = "";

        try {

          domain =
            new URL(cleanSourceUrl)
              .hostname
              .replace(/^www\./, "");

        } catch (error) {

          console.log(
            "⚠️ INVALID SOURCE URL:",
            item.url
          );
        }

        return {

          title:
            item.title ||
            domain ||
            "Web Source",

          url:
            cleanSourceUrl,

          domain:
            domain
        };

      });
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

if (
  Array.isArray(rankedWebResults) &&
  rankedWebResults.length > 0
) {

  searchContext =
    "WEB SEARCH EVIDENCE:\n\n" +

    rankedWebResults
      .slice(0, 8)
      .map(
        (item, i) =>
          `${i + 1}. TITLE: ${
            item.title?.trim() || "Unknown"
          }\n` +

          `PUBLISHED/UPDATED: ${
            item.publishedDate ||
            "Date unavailable"
          }\n` +

          `CONTENT: ${
            item.content?.trim() ||
            "No content available"
          }\n` +

          `SOURCE: ${
            item.url ||
            "Unknown"
          }\n` +

          `IMPORTANT: Treat the publication/update date and source authority as important when deciding whether this information is current.`
      )
      .join("\n\n");

}

console.log(
  "========== SEARCH CONTEXT =========="
);

console.log(searchContext);

console.log(
  "===================================="
);


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

// ==================================================
// CURRENT OFFICE HOLDER QUESTIONS
// ==================================================

For questions asking who currently holds a public office,
the word "current" is NOT required.

For example:

- Who is the Chief Minister of Maharashtra?
- Who is CM of Maharashtra?
- Maharashtra cha मुख्यमंत्री कोण आहे?
- Maharashtra cha मुख्यमंत्री kon ahet?
- Who is the Prime Minister of India?
- Who is the current Prime Minister of India?
- Who is the Governor of Maharashtra?

These questions should normally be interpreted as asking for
the person who currently holds that position.

Therefore:

1. Do NOT answer based only on the appointment date.
2. Do NOT assume the person is still in office merely because
   an old article says they were appointed.
3. Check the newest reliable information in the WEB SEARCH RESULTS.
4. Prefer official government sources and recent reliable sources.
5. If an old source says "appointed in 2024", that is historical
   information and must NOT be presented as proof that the person
   is still the current office holder.
6. The answer should identify the CURRENT office holder first.
7. Mention the appointment/start date only if it is useful.
8. Do NOT begin the answer with phrases such as
   "As of December 5, 2024" when the user did not ask about 2024.
9. Do NOT give a historical list of previous office holders unless
   the user asks for it.

Example:

User:
"Who is CM of Maharashtra?"

Correct answer style:
"Devendra Fadnavis is the current Chief Minister of Maharashtra.
He has been serving as Chief Minister since December 5, 2024."

Incorrect answer style:
"As of December 5, 2024, Devendra Fadnavis is the Chief Minister..."

The first sentence must answer the user's actual question directly.

==================================================
PRICE / PRODUCT QUESTIONS — CURRENT PRICE
==================================================

If the user asks for the price of a product without specifying
a date, they are asking for the CURRENT / PRESENTLY AVAILABLE
price.

This applies to:

- mobile phones
- laptops
- TVs
- watches
- headphones
- tablets
- electronics
- vehicles
- accessories
- any other product

IMPORTANT:

The answer MUST prioritize the newest reliable CURRENT price.

==================================================
PRICE SEARCH RULE
==================================================

For every normal product price question:

1. Use the available WEB SEARCH RESULTS.

2. Look for the newest reliable price information.

3. Prefer sources in this order:

   1. Official manufacturer website/store
   2. Official retailer/store listing
   3. Major reliable retailers
   4. Recent reliable technology/news websites
   5. Older articles only as supporting information

4. Compare the publication/listing dates of the results.

5. A recent price increase/decrease report is NOT itself the
   current price.

6. If a result says:

   "Price will increase from August"

   that does NOT mean the new price is known.

7. If the exact current price after the increase is NOT available
   from a reliable source, do NOT calculate, assume or guess it.

8. In that situation clearly say:

   "The latest exact price could not be reliably verified."

9. Do NOT present an older confirmed price as the current price
   merely because it is the newest exact number available.

10. If the latest reliable source gives an exact current price,
    use that price directly.

==================================================
PRICE CONFLICT RULE
==================================================

If search results contain:

- an older exact price
- a newer report saying the price changed
- but no newer exact price

then DO NOT answer with the older exact price as if it were
the current price.

Instead say:

"The latest available information indicates that the price has
changed, but the new exact price could not be reliably verified."

You MAY mention the older price only if useful, and clearly label it
as the previous/older price.

Example:

"Realme P4 Pro ची सध्याची exact किंमत उपलब्ध search results मधून
विश्वसनीयपणे verify करता येत नाही.

1 August 2026 रोजी ₹28,999 ची price reported होती, पण त्यानंतर
price increase झाल्याची माहिती आहे. त्यामुळे ₹28,999 ला सध्याची
किंमत म्हणून सांगणे योग्य नाही."

==================================================
VARIANT RULE
==================================================

If multiple storage/RAM variants exist and current prices are
available, show them separately.

Example:

8GB + 128GB — ₹XX,XXX
8GB + 256GB — ₹XX,XXX
12GB + 256GB — ₹XX,XXX

Only show a variant price if it is supported by reliable
current search evidence.

==================================================
CURRENT PRICE FIRST
==================================================

If the current exact price is verified:

"Vivo V70 ची सध्याची किंमत ₹XX,XXX पासून आहे."

Only after that, if useful, mention:

- launch price
- previous price
- discount
- price increase
- older price

Never put an old price first.

==================================================
NO GUESSING
==================================================

NEVER:

- calculate a new price from a percentage increase
- assume a retailer price is still active
- convert a foreign price into an Indian price and present it
  as the Indian current price
- use an old launch price as the current price
- use an old article as proof of today's price
- invent an exact price

If the exact current price cannot be verified, say so clearly.

==================================================
IMPORTANT INTERPRETATION
==================================================

These questions normally mean CURRENT PRICE:

"Vivo V70 price kiti?"
"Vivo V70 chi price kiti ahe?"
"Realme P4 Pro kiti la ahe?"
"iPhone 17 price?"
"Samsung S26 kiti?"
"OnePlus Nord CE 5 price?"
"Laptop kiti la ahe?"

The user does NOT need to say:

- current
- latest
- today
- now

The normal interpretation is CURRENT AVAILABLE PRICE.

Only use historical pricing when the user explicitly asks:

"launch price kiti hoti?"
"original price?"
"2025 madhye price kiti hoti?"
"launch zala tevha kiti hota?"
"previous price?"

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
FOLLOW-UP / SUGGESTED QUESTIONS
==================================================

After answering the user's question, generate 3 short and useful
follow-up questions based specifically on the answer you just gave.

Rules:

1. Follow-up questions MUST be relevant to the user's current question.
2. They must NOT be generic questions.
3. They must NOT repeat the original user question.
4. They should help the user naturally continue the conversation.
5. Prefer questions about:
   - important missing details
   - latest/current developments
   - explanation of an important point
   - comparison
   - next steps
   - consequences or impact
6. Keep each question short and natural.
7. Use the SAME language as the user's current question.
8. If the user writes Roman Marathi, generate Roman Marathi.
9. If the user writes Marathi, generate Marathi.
10. If the user writes English, generate English.
11. Generate exactly 3 questions.
12. Do NOT put numbers before the questions.
13. Do NOT use bullets inside the JSON.
14. Return valid JSON only inside the follow-up marker.

The follow-up section MUST be returned exactly in this format:

<<<VEDAAI_FOLLOWUPS_START>>>
["Question 1","Question 2","Question 3"]
<<<VEDAAI_FOLLOWUPS_END>>>

IMPORTANT:
- Do not change the marker names.
- Do not add Markdown around the JSON.
- Do not add explanations before or after the follow-up JSON.
- The follow-up section must appear AFTER the complete AI answer.

==================================================

WEB SEARCH RESULTS:

${searchContext}

==================================================

CONVERSATION / FINAL USER PROMPT:

${finalPrompt}

==================================================

==================================================
FINAL INSTRUCTION:

Now answer the user's current question accurately, naturally,
concisely when possible, and using the most relevant available
information.

After the complete answer, generate exactly 3 dynamic follow-up
questions according to the FOLLOW-UP / SUGGESTED QUESTIONS rules.

The final response MUST follow this structure:

[COMPLETE AI ANSWER]

<<<VEDAAI_FOLLOWUPS_START>>>
["Question 1","Question 2","Question 3"]
<<<VEDAAI_FOLLOWUPS_END>>>

Do not place anything after the follow-up end marker.
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
      return {
  stream,
  sources,
};

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

const result = await callGeminiStream(
  userMessage,
  finalPrompt,
  history
);

const stream = result.stream;
const sources = result.sources || [];

console.log("🟢 AFTER callGeminiStream");
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

  console.log("========== FULL ERROR DETAILS ==========");
  console.log("NAME:", err?.name);
  console.log("MESSAGE:", err?.message);
  console.log("STATUS:", err?.status);
  console.log("CODE:", err?.code);
  console.log("CAUSE:", err?.cause);
  console.log("RESPONSE:", err?.response?.data);
  console.log(
    "ERROR OBJECT:",
    JSON.stringify(
      err,
      Object.getOwnPropertyNames(err),
      2
    )
  );
  console.log("========================================");


  // ================= 429 / QUOTA ERROR =================

  if (
    err.status === 429 ||
    err.message?.includes("429") ||
    err.message?.includes("RESOURCE_EXHAUSTED")
  ) {

    console.log("⚠️ GEMINI QUOTA EXCEEDED");

    res.write(
      "<<<VEDAAI_RESPONSE_START>>>\n"
    );

    res.write(
      "AI is temporarily busy. Please try again in a few seconds."
    );

    res.write(
      "\n<<<VEDAAI_RESPONSE_END>>>\n"
    );

    return res.end();
  }


  // ================= 503 ERROR =================

  if (
    err.status === 503 ||
    err.message?.includes("503") ||
    err.message?.includes("UNAVAILABLE")
  ) {

    console.log("⚠️ GEMINI TEMPORARILY UNAVAILABLE");

    res.write(
      "<<<VEDAAI_RESPONSE_START>>>\n"
    );

    res.write(
      "AI is temporarily unavailable. Please try again later."
    );

    res.write(
      "\n<<<VEDAAI_RESPONSE_END>>>\n"
    );

    return res.end();
  }


  // ================= OTHER ERROR =================

  console.log("⚠️ UNKNOWN GEMINI ERROR");

  res.write(
    "<<<VEDAAI_RESPONSE_START>>>\n"
  );

  res.write(
    "Something went wrong. Please try again later."
  );

  res.write(
    "\n<<<VEDAAI_RESPONSE_END>>>\n"
  );

  return res.end();
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

