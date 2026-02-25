import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "../types";

export class GeminiService {
  private ai: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    if (!this.ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "GEMINI_API_KEY is not configured. Add it to your Vercel environment variables and redeploy."
        );
      }
      this.ai = new GoogleGenAI({ apiKey });
    }
    return this.ai;
  }

  async chat(
    systemInstruction: string,
    history: ChatMessage[],
    message: string
  ): Promise<string> {
    const model = "gemini-2.0-flash";

    // Convert history to Gemini format
    const contents = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    // Add current message
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const response = await this.getClient().models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
      }
    });

    return response.text || "I'm sorry, I couldn't process that.";
  }
}

export const geminiService = new GeminiService();
