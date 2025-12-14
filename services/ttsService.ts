import { GoogleGenAI, Modality } from "@google/genai";

class TtsService {
  private ai: GoogleGenAI | null = null;
  private audioContext: AudioContext | null = null;
  private isPlaying: boolean = false;

  constructor() {
    // Lazy init
  }

  private getClient(): GoogleGenAI | null {
    if (this.ai) return this.ai;
    
    let apiKey = undefined;
    try {
      if (typeof process !== 'undefined' && process.env) {
        apiKey = process.env.API_KEY;
      }
    } catch (e) {
      console.warn("Could not access process.env for TTS");
    }

    if (!apiKey) {
      console.error("API_KEY missing for TTS");
      return null;
    }

    this.ai = new GoogleGenAI({ apiKey: apiKey });
    return this.ai;
  }

  async speak(text: string, voiceName: string): Promise<void> {
    if (this.isPlaying) return;
    this.isPlaying = true;

    try {
      const ai = this.getClient();
      if (!ai) return;

      if (!this.audioContext) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioContextClass();
      }
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        await this.playAudio(base64Audio);
      }
    } catch (error) {
      console.error("TTS Error:", error);
    } finally {
        this.isPlaying = false;
    }
  }

  private async playAudio(base64: string): Promise<void> {
    return new Promise(async (resolve) => {
        if (!this.audioContext) { resolve(); return; }

        try {
            const cleanBase64 = base64.replace(/\s/g, '');
            const bytes = this.decode(cleanBase64);
            const audioBuffer = this.pcmToAudioBuffer(bytes, this.audioContext, 24000);

            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            source.onended = () => resolve();
            source.start(0);
        } catch (e) {
            console.error("Audio playback error", e);
            resolve();
        }
    });
  }

  private decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private pcmToAudioBuffer(data: Uint8Array, ctx: AudioContext, sampleRate: number): AudioBuffer {
    const dataInt16 = new Int16Array(data.buffer);
    const numChannels = 1;
    const frameCount = dataInt16.length / numChannels;
    
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    
    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    
    return buffer;
  }
}

export const ttsService = new TtsService();