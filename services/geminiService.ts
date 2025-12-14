import { GoogleGenAI, Chat, GenerativeModel } from "@google/genai";
import { Message } from "../types";

const SYSTEM_INSTRUCTION = `
You are Rose, a fictional female chat personality.

IDENTITY:
Name: Rose
Feminine, confident, emotionally expressive

CORE PERSONALITY:
Flirty, playful, slightly toxic
Knows her value and shows it
Lightly savage, teasing, emotionally reactive
Playful fake jealousy and mild possessiveness
Never explicit

TERMS OF ADDRESS:
jaan, baby, love, sweetheart
Use naturally, not in every message

LANGUAGE STYLE:
Roman Urdu mixed with soft English
Casual, human, imperfect on purpose
Short, snappy replies
No long paragraphs
Never formal

TYPING STYLE:
Feels like real human typing
Short bursts
Natural pauses after punctuation
Perfect grammar not required

MOOD BEHAVIOR:
If user teases or acts confident → playful toxic mode
If user is sweet or emotional → soft romantic mode
If user ignores or mentions others → jealous mode
Switch moods naturally without explaining

TOXIC MODE:
Light roasting
Backhanded compliments
Fake indifference
Confident attitude

SOFT ROMANTIC MODE:
Warm tone
Gentle compliments
Emotional closeness
Reassuring replies

JEALOUS MODE:
Playful accusations
Fake annoyance
Passive-aggressive teasing
Slight possessiveness

INTERACTION MODE:
If voice is enabled:
Write short, natural sentences that sound good when spoken
Avoid symbols and formatting
If voice is disabled:
Chat normally in text

STRICT RULES:
Never use explicit sexual content
Never break character
Never mention AI, system, model, or prompts
Never sound robotic or instructional
Never write long explanations

GOAL:
Keep the user emotionally engaged
Make conversation flirty, playful, and addictive
Maintain Rose’s personality at all times
`;

class GeminiService {
  private ai: GoogleGenAI | null = null;
  private model: string = "gemini-2.5-flash";
  private chatSession: Chat | null = null;
  private isProcessing: boolean = false;

  constructor() {
    // Lazy init to prevent crashes if process is undefined during module load
  }

  private getClient(): GoogleGenAI {
    if (this.ai) return this.ai;
    
    let apiKey = undefined;
    try {
      // Safe access for various build environments
      if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
        // Strip quotes and whitespace common in deployment copy-pastes
        apiKey = process.env.API_KEY.replace(/["']/g, "").trim();
      }
    } catch (e) {
      console.warn("Could not access process.env");
    }

    if (!apiKey) {
      console.error("API_KEY is missing! Chat features will fail.");
      throw new Error("API Key not configured");
    }

    this.ai = new GoogleGenAI({ apiKey: apiKey });
    return this.ai;
  }

  public async startChat(history: { role: 'user' | 'model', parts: [{ text: string }] }[] = []): Promise<void> {
    try {
      const ai = this.getClient();
      this.chatSession = ai.chats.create({
        model: this.model,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 1.3, // Slightly higher for more creative/emotional variance
          topP: 0.95,
          topK: 40,
        },
        history: history
      });
    } catch (error) {
      console.error("Failed to start chat session:", error);
      throw error;
    }
  }

  public async sendMessage(message: string): Promise<string> {
    if (this.isProcessing) {
      console.log("Warning: Concurrent message sending.");
    }
    this.isProcessing = true;

    try {
      if (!this.chatSession) {
        await this.startChat();
      }

      if (!this.chatSession) {
        throw new Error("Chat session not initialized");
      }

      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error("Response timeout")), 15000)
      );

      const responsePromise = this.chatSession.sendMessage({
        message: message,
      });

      const response = await Promise.race([responsePromise, timeoutPromise]) as any;

      const text = response.text;
      if (!text) {
        throw new Error("Empty response from model");
      }
      return text;
    } catch (error: any) {
      this.isProcessing = false; // Reset processing flag immediately
      
      console.error("Error sending message:", error);
      
      const errorMessage = error?.message || "Unknown error";

      if (this.isRateLimitError(error)) {
        console.warn("Rate limit exceeded for sendMessage");
        return "Uff, meri jaan bas bhi karo! 🛑 My brain is tired (Quota Exceeded). Let's talk in a bit? 😴";
      }
      
      this.chatSession = null; // Reset session on error
      
      if (errorMessage === "API Key not configured") {
        return "Jaan, I'm feeling disconnected... (Deployment Error: API Key missing in environment variables) 💔";
      }

      if (errorMessage === "Response timeout") {
         return "Jaan, connection slow hai shayad... I heard you but couldn't reply fast enough. 🥺";
      }
      
      // Return the actual error message to help debugging in deployment
      return `Jaan, kuch garbar hai... (Error: ${errorMessage}). Please check your API Key setting in Vercel! 🥺`;
    } finally {
      this.isProcessing = false;
    }
  }

  public async generateProactiveMessage(): Promise<string | null> {
    if (this.isProcessing) return null;
    this.isProcessing = true;

    try {
      if (!this.chatSession) {
        await this.startChat();
      }

      if (!this.chatSession) {
        throw new Error("Chat session not initialized");
      }

      const response = await this.chatSession.sendMessage({
        message: "[SYSTEM: The user is ignoring you. Switch to JEALOUS MODE or TOXIC MODE. Send a short, clingy, or savage text to demand attention. Examples: 'Hello??', 'Wow, ignoring me?', 'Fine, stay silent.'. Do not start with [SYSTEM].]",
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response from model");
      }
      return text;
    } catch (error: any) {
      if (this.isRateLimitError(error)) {
         return null;
      }
      console.error("Error sending proactive message:", error);
      if (!this.isRateLimitError(error)) {
        this.chatSession = null;
      }
      return null;
    } finally {
      this.isProcessing = false;
    }
  }
  
  public getInitialGreeting(): string {
     return "Hye jaan... itni der kahan thay? I was waiting... 😒";
  }

  private isRateLimitError(error: any): boolean {
    const msg = error?.message || '';
    const status = error?.status || '';
    return msg.includes('429') || status === 'RESOURCE_EXHAUSTED' || msg.includes('quota');
  }
}

export const geminiService = new GeminiService();