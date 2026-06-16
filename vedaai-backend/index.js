const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const API_KEY = process.env.GEMINI_API_KEY;

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${AQ.Ab8RN6JAIxJBD1ZiKLS8jci4oBQH80tWg_P0l0jVieKeGskRNg}`,
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
      response.data.candidates[0].content.parts[0].text;

    res.json({ reply: aiText });

  } catch (error) {
    console.log(error.response?.data || error.message);
    res.status(500).json({ error: "Server Error" });
  }
});

app.listen(3000, "0.0.0.0", () => {
  console.log("Server running on port 3000");
});