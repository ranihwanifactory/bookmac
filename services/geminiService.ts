import { GoogleGenAI, Type } from "@google/genai";

let ai: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!ai) {
    // Check if process is defined to avoid crashing in environments without polyfills
    const apiKey = typeof process !== 'undefined' && process.env ? process.env.API_KEY : '';
    if (apiKey) {
      ai = new GoogleGenAI({ apiKey });
    }
  }
  return ai;
};

export const generateBookContent = async (bookTitle: string, author: string): Promise<{ review: string, quote: string } | null> => {
  try {
    const client = getAiClient();
    if (!client) {
      console.warn("Gemini API Key not found or client not initialized");
      return null;
    }

    const model = 'gemini-2.5-flash';
    const prompt = `
      I am writing a social media post about the book "${bookTitle}" by ${author}.
      Please generate the following content in Korean language:
      1. A short, engaging review (max 200 characters) that fits a social media caption style.
      2. A famous or meaningful quote from the book.
    `;

    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            review: {
              type: Type.STRING,
            },
            quote: {
              type: Type.STRING,
            },
          },
          required: ["review", "quote"],
        },
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