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

export const identifyLocation = async (lat: number, lng: number): Promise<string | null> => {
  try {
    const client = getAiClient();
    if (!client) return null;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: "이 좌표가 위치한 도시나 동네 이름(랜드마크 등)을 한국어로 간단히 알려줘 (예: 서울시 강남구).",
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          googleMaps: {
            retrievalConfig: {
                latLng: {
                    latitude: lat,
                    longitude: lng
                }
            }
          }
        }
      }
    });
    
    // Check for grounding metadata URLs if needed, but for now we just want the text name
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
        // console.log("Grounding Chunks:", chunks);
    }
    
    return response.text || "알 수 없는 위치";
  } catch (error) {
    console.error("Error identifying location:", error);
    return null;
  }
};