import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini
// Always use process.env.API_KEY directly as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateBookContent = async (bookTitle: string, author: string): Promise<{ review: string, quote: string } | null> => {
  try {
    const model = 'gemini-2.5-flash';
    const prompt = `
      I am writing a social media post about the book "${bookTitle}" by ${author}.
      Please generate the following content in Korean language:
      1. A short, engaging review (max 200 characters) that fits a social media caption style.
      2. A famous or meaningful quote from the book.
    `;

    const response = await ai.models.generateContent({
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