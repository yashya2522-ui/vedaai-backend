const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const API_KEY = process.env.GEMINI_API_KEY;

console.log("API KEY FOUND:", !!API_KEY);

app.get("/", (req, res) => {
res.send("VedaAI backend running 🚀");
});

app.post("/chat", async (req, res) => {
try {
const userMessage = req.body.message;

if (!userMessage) {
  return res.status(400).json({
    error: "Message is empty"
  });
}
const response = await axios.post( `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`, 
  {
     contents: [ 
      { parts: [ 
        { 
         text:
          "You are VedaAI assistant. Give clear and simple answers.\nUser: " + userMessage 

  }
 ]
 } 
]
 } 
);
const aiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text; res.json({ reply: aiText || "No response from Gemini" }

);
} catch (error) {
  console.log("Status:", error.response?.status);
  console.log("Data:", error.response?.data);
  console.log("Message:", error.message);

  res.status(500).json({ error: "Server Error" });
}
},
)
app.listen(3000, "0.0.0.0", () => {
console.log("🔥 VedaAI Server running on port 3000");
});
