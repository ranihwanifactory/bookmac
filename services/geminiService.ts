import { GoogleGenAI } from "@google/genai";

// Initialize Gemini
// Note: In a real production app, ensure strict backend proxy or secure env usage.
// Assuming process.env.API_KEY is available as per instructions.
const apiKey = process.env.API_KEY || ''; 
// Fallback logic if key is missing is handled in the UI (disabling the button)

let ai: GoogleGenAI | null = null;
if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
}

export const generateBookContent = async (bookTitle: string, author: string): Promise<{ review: string, quote: string } | null> => {
  if (!ai) {
    console.warn("Gemini API Key not found");
    return null;
  }

  try {
    const model = 'gemini-2.5-flash';
    const prompt = `
      I am writing a social media post about the book "${bookTitle}" by ${author}.
      Please generate the following content in Korean language:
      1. A short, engaging review (max 200 characters) that fits a social media caption style.
      2. A famous or meaningful quote from the book.
      
      Return the response in strictly valid JSON format:
      {
        "review": "string",
        "quote": "string"
      }
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) return null;

    return JSON.parse(text);
  } catch (error) {
    console.error("Error generating content with Gemini:", error);
    return null;
  }
};