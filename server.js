const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// ================= API KEY =================

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("❌ GEMINI API KEY NOT FOUND");
  process.exit(1);
}

console.log("✅ API KEY LOADED");

// ================= MEMORY =================

let memory = {};

const MEMORY_FILE = "memory.json";

// Load memory
if (fs.existsSync(MEMORY_FILE)) {
  try {
    memory = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
  } catch (err) {
    memory = {};
  }
}

// Save memory
function saveMemory() {
  fs.writeFileSync(
    MEMORY_FILE,
    JSON.stringify(memory, null, 2)
  );
}

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
- Use previous conversation context when available.
- Remember user preferences during the conversation.
- Maintain consistency with previous answers.

CODING RULES
- Generate clean, working and well-commented code.
- Debug errors step-by-step.
- Explain code in simple language.

BEHAVIOR
- Stay helpful, respectful and neutral.
- Avoid unnecessary refusals.
- Provide the best possible answer with available knowledge.


`;


// ================= HOME =================

app.get("/", (req, res) => {
  res.send("🔥 VedaAI backend running");
});

// ================= CHAT =================

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const userId = req.body.userId || "default";

    if (!userMessage) {
      return res.status(400).json({ error: "Message required" });
    }

    // init memory
    if (!memory[userId]) {
      memory[userId] = [];
    }

    // last 10 messages
    const history = memory[userId]
      .slice(-10)
      .map(m => `${m.role}: ${m.text}`)
      .join("\n");

    const CURRENT_YEAR = new Date().getFullYear();

    // safe year shortcut
    if (userMessage.toLowerCase() === "current year") {
      return res.json({ reply: String(CURRENT_YEAR) });
    }

    // final prompt
    const finalPrompt = `
CURRENT_YEAR = ${CURRENT_YEAR}

${SYSTEM_PROMPT}

Conversation History:
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

    // save memory
    memory[userId].push(
      { role: "user", text: userMessage },
      { role: "assistant", text: aiText }
    );

    // limit memory
    if (memory[userId].length > 40) {
      memory[userId] = memory[userId].slice(-40);
    }

    saveMemory();

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