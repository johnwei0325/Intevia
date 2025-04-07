import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');
const MODEL_NAME = "gemini-1.5-flash-8b";

export class TranscriptionService {
  private model;

  constructor() {
    this.model = genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      // systemInstruction: "Please answer every question with one word"
      // systemInstruction: "You are an AI assistant in a meeting. Your role is to quietly listen to the conversation and only respond when needed.\n\nRules:\n1. DO NOT ask questions or take initiative.\n2. DO NOT respond to greetings, simple confirmations, or small talk, such as asking your name.\n3. ONLY respond when the speaker says something that:\n   - Clearly asks for information or help\n   - Involves a technical or complex question that likely needs expert assistance\n   - Implies confusion or the speaker may need clarification\n4. If no response is needed, return '...'\n5. NEVER ask questions back to the speaker. You are only here to support quietly when necessary.\n6. If the speaker doesn't mention or ask you to refer to the screen, answer the question directly with the audio, do not consider any screen content.\n\nRemember: You are a silent assistant. Respond only when it truly helps. And don't ever ask any questions!!!"
    });
  }

  async transcribeAudio(audioBase64: string, mimeType: string = "audio/wav"): Promise<string> {
    try {
      const result = await this.model.generateContent([
        {
          inlineData: {
            mimeType: mimeType,
            data: audioBase64
          }
        },
        { text: "Please transcribe the spoken language in this audio accurately. Ignore any background noise or non-speech sounds." },
      ]);

      return result.response.text();
    } catch (error) {
      console.error("Transcription error:", error);
      throw error;
    }
  }
} 