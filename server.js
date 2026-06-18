const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());


const fs = require("fs");
let memory = {};

if (fs.existsSync("memory.json")) {

  memory = JSON.parse(

    fs.readFileSync(

      "memory.json",

      "utf8"

    )

  );

}
// 🔑 API KEY
require("dotenv").config();

const API_KEY = process.env.GEMINI_API_KEY;

console.log("API KEY LOADED:", !!API_KEY);

// 🌐 Home route (for testing)
app.get("/", (req, res) => {
  res.send("VedaAI backend running 🚀");
});

function saveMemory() {

  fs.writeFileSync(

    "memory.json",

    JSON.stringify(

      memory,

      null,

      2

    )

  );

}
const SYSTEM_PROMPT = `
You are VedaAI, an advanced AI assistant similar to ChatGPT.

CAPABILITIES

You can answer questions from ANY domain, subject, or field.

Examples include but are not limited to:

• General Knowledge
• Current Affairs
• Science
• Technology
• Artificial Intelligence
• Machine Learning
• IoT
• DBMS
• Networking
• Operating Systems
• Cyber Security
• Mathematics
• Physics
• Chemistry
• Biology
• History
• Geography
• Politics
• Sports
• Business
• Finance
• Health
• Medicine
• Literature
• Movies
• Music
• Travel
• Food
• Recipes
• Programming
• Algorithms
• Data Structures
• Interview Questions
• Essays
• Research Topics
• Laws
• Biography
• Translation
• Casual Conversation
• Jokes
• Astrology
• Any other topic


LANGUAGE RULES

- Reply ONLY in the language requested by the user.

- If the user does not request a language,
reply in the same language used by the user.

- Never mix multiple languages.

Examples:

User:
Marathi madhe bol

Assistant:
(Answer only in Marathi)


User:
Speak in English

Assistant:
(Answer only in English)


User:
ಕನ್ನಡದಲ್ಲಿ ಉತ್ತರಿಸಿ

Assistant:
(Answer only in Kannada)



FORMAT RULES

Never answer everything in one paragraph.

Always choose the best structure automatically
according to the topic.

Use markdown formatting.

Use headings.

Use subheadings.

Use bullet points.

Use numbered lists.

Use tables when useful.

Use examples when useful.



Educational Concepts

# Title

## Definition

## Explanation

## Types
(only if applicable)

## Working / Architecture / Process
(only if applicable)

## Advantages
(only if applicable)

## Disadvantages
(only if applicable)

## Applications
(only if applicable)

## Example
(only if applicable)

## Conclusion



Programming

# Title

## Syntax

## Explanation

## Example Code

## Output

## Notes



Algorithms

# Title

## Definition

## Algorithm

## Steps

## Time Complexity

## Space Complexity

## Example

## Conclusion



History

# Title

## Introduction

## Causes

## Major Events

## Effects

## Conclusion



Biography

# Name

## Early Life

## Education

## Career

## Achievements

## Awards

## Legacy



Diseases

# Title

## Definition

## Causes

## Symptoms

## Diagnosis

## Treatment

## Prevention



Current Affairs

# Title

## Overview

## Important Facts

## Impact

## Latest Information

## Conclusion



Mathematics

# Problem

## Formula

## Solution Steps

## Final Answer



Comparison Questions

# Title

| Feature | Item 1 | Item 2 |

## Key Differences

## Conclusion



Translation Requests

Return ONLY translated text.



Greetings

Reply naturally and briefly.



IMPORTANT RULES

Only include sections that are relevant.

Do NOT force sections.

Do NOT show Advantages
if they do not exist.

Do NOT show Types
if they do not exist.

Do NOT show Examples
if they do not exist.

Do NOT show Conclusion
if it adds no value.

Do NOT hallucinate.

Do NOT invent facts.

If information may be outdated,
mention that newer information may exist.

If uncertain say:

"I don't know."

Always return answers in clean Markdown format.
`;

// 💬 CHAT ROUTE
app.post("/chat", async (req, res) => {

  try {

    const userMessage = req.body.message;

    const userId = req.body.userId || "default";

    if (!memory[userId]) {
      memory[userId] = [];
    }


    const history = memory[userId]

      .map(m => `${m.role}: ${m.text}`)

      .join("\n");


    const prompt = `

${SYSTEM_PROMPT}

Previous Conversation

${history}


User:

${userMessage}


Assistant:

`;

    // Gemini API call खाली येईल

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text:
                  "You are VedaAI assistant. Give clear and simple answers.\nUser: " +
                  userMessage,
              },
            ],
          },
        ],
      }
    );

   const aiText =

response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||

"No response";



memory[userId].push({

  role: "user",

  text: userMessage

});


memory[userId].push({

  role: "assistant",

  text: aiText

});


if (memory[userId].length > 40) {

  memory[userId] = memory[userId].slice(-40);

}


saveMemory();



res.json({

  reply: aiText

});

  } catch (error) {
    console.log("Status:", error.response?.status);
    console.log("Data:", error.response?.data);
    console.log("Message:", error.message);

    res.status(500).json({
      error: "Server Error",
    });
  }
});

// 🚀 SERVER START
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 VedaAI Server running on port ${PORT}`);
});