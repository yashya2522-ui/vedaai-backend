require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function test() {

  try {

    console.log("KEY EXISTS:", !!process.env.GEMINI_API_KEY);
    console.log("KEY PREFIX:", process.env.GEMINI_API_KEY.substring(0, 6));

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: "Say Hello",
    });

    console.log(response.text);

  } catch (err) {

    console.log("FULL ERROR:");
    console.log(err);

  }

}

test();