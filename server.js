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
You are VedaAI, a helpful AI assistant.

Rules:
- Reply in same language as user
- Use Markdown
- Be accurate
- If unsure say "I don't know"
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