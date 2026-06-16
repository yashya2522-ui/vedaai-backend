const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// ✅ API KEY from Render / .env
const API_KEY = process.env.GEMINI_API_KEY;

// 🔥 Health check route (optional but good)
app.get("/", (req, res) => {
  res.send("VedaAI Backend is running 🚀");
});

// 💬 CHAT ROUTE
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!API_KEY) {
      return res.status(500).json({ error: "API Key missing" });
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`,
      {
        contents: [
          {
            parts: [
              { text: userMessage }
            ]
          }
        ]
      }
    );

    const aiText =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    res.json({ reply: aiText || "No response from AI" });

  } catch (error) {
    console.log("ERROR:", error.response?.data || error.message);
    res.status(500).json({ error: "Server Error" });
  }
});

// 🚀 SERVER START
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});