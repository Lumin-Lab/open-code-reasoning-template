import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Note: This service demonstrates the correct implementation pattern for Gemini API.
// Since we cannot guarantee an API key is present in this demo environment, 
// the App.tsx will fallback to a mock script, but this file shows the expert implementation.

const API_KEY = process.env.API_KEY || '';

let ai: GoogleGenAI | null = null;

if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
}

export const generateDebateResponse = async (
  history: { role: string; parts: { text: string }[] }[],
  lastSpeaker: string
): Promise<string> => {
  if (!ai) {
    console.warn("Gemini API Key not found. Returning mock response.");
    return "I need an API key to think of a real response!";
  }

  const model = 'gemini-2.5-flash';
  
  const systemInstruction = `
    You are simulating a debate between two AI personas: 'Tutor AI' and 'Student AI'.
    The topic is JavaScript 'let' vs 'const'.
    
    Tutor AI: Experienced, patient, precise, uses analogies.
    Student AI: Curious, slightly skeptical of legacy code, asks practical questions.
    
    The last speaker was ${lastSpeaker}. Generate the response for the OTHER speaker.
    Keep it conversational, short (under 2 sentences), and strictly about the code snippet provided.
  `;

  try {
    const chat = ai.chats.create({
      model: model,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    // We would reconstruct the chat history here if using the stateful chat API,
    // or just use generateContent with the full history stringified.
    // For this snippet, we'll assume a single turn generation for simplicity.
    
    const prompt = `Continue the debate. The previous message was: "${history[history.length - 1].parts[0].text}"`;

    const result: GenerateContentResponse = await chat.sendMessage({
      message: prompt
    });

    return result.text || "";
  } catch (error) {
    console.error("Error generating debate response:", error);
    return "I'm having trouble thinking right now.";
  }
};
