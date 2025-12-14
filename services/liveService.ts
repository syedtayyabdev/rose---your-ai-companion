import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

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

class LiveService {
  private ai: GoogleGenAI | null = null;
  private model: string = "gemini-2.5-flash-native-audio-preview-09-2025";
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private outputAnalyser: AnalyserNode | null = null; // To visualize Rose's voice
  private nextStartTime: number = 0;
  private sources: Set<AudioBufferSourceNode> = new Set();
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private animationFrameId: number | null = null;
  public isMuted: boolean = false;
  
  // Default to Zephyr, but allow changes
  public voiceName: string = 'Zephyr';

  public onVolumeChange: ((volume: number) => void) | null = null; // User volume
  public onOutputVolumeChange: ((volume: number) => void) | null = null; // Rose volume
  public onFrequencyData: ((data: number[]) => void) | null = null; // Frequency data for visualizer
  public onIsSpeakingChange: ((isSpeaking: boolean) => void) | null = null;
  public onDisconnect: (() => void) | null = null;

  constructor() {
    // Initialize lazily in startSession
  }

  public setVoice(voice: string) {
      this.voiceName = voice;
  }

  // Called directly by the "Phone" button click to unlock AudioContext
  public async initializeAudio() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    
    // Close existing if any to prevent duplicates
    if (this.inputAudioContext) await this.inputAudioContext.close();
    if (this.outputAudioContext) await this.outputAudioContext.close();

    // 16kHz for input (API requirement), 24kHz for output (High quality)
    this.inputAudioContext = new AudioContextClass({ sampleRate: 16000 });
    this.outputAudioContext = new AudioContextClass({ sampleRate: 24000 });

    // Setup Output Analyser for Visualizer
    this.outputAnalyser = this.outputAudioContext.createAnalyser();
    this.outputAnalyser.fftSize = 512;
    this.outputAnalyser.smoothingTimeConstant = 0.5; // Smoother transitions
    
    // Resume immediately inside the user gesture
    await this.outputAudioContext.resume();
    await this.inputAudioContext.resume();
  }

  public async startSession() {
    let apiKey = undefined;
    try {
      if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
        apiKey = process.env.API_KEY.replace(/["']/g, "").trim();
      }
    } catch(e) {
      console.error("Error accessing process.env", e);
    }
    
    if (!apiKey) {
        console.error("API Key not found");
        throw new Error("API Key not configured");
    }
    this.ai = new GoogleGenAI({ apiKey });

    if (!this.outputAudioContext || !this.inputAudioContext) {
      await this.initializeAudio();
    }

    this.nextStartTime = 0;
    this.sources.clear();

    try {
        // Get Microphone Stream with enhanced processing
        this.stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });
    } catch (e) {
        console.error("Microphone permission failed", e);
        throw e;
    }

    if (!this.ai) {
        throw new Error("GoogleGenAI client not initialized");
    }

    // Connect to Gemini Live
    this.sessionPromise = this.ai.live.connect({
      model: this.model,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: this.voiceName } },
        },
        systemInstruction: SYSTEM_INSTRUCTION,
      },
      callbacks: {
        onopen: async () => {
          console.log(`Live session connected with voice: ${this.voiceName}`);
          this.startAudioInput();
          
          // 1. Send silence to establish the stream immediately
          const silence = new Float32Array(1024).fill(0); 
          this.sendRealtimeInput(silence);
          
          // 2. Force wake-up trigger after a short delay to ensure she speaks first
          setTimeout(() => {
              this.sessionPromise?.then((session) => {
                  try {
                      console.log("Sending wake-up trigger...");
                      session.send({
                          clientContent: {
                              turns: [{
                                  role: 'user',
                                  parts: [{ text: "Hello Rose! Connect call. Speak to me now darling." }]
                              }],
                              turnComplete: true
                          }
                      });
                  } catch (e) {
                      console.warn("Could not send wake-up trigger", e);
                  }
              });
          }, 800); 
        },
        onmessage: async (message: LiveServerMessage) => {
          this.handleServerMessage(message);
        },
        onclose: () => {
          console.log("Live session closed");
          this.stopSession();
        },
        onerror: (err) => {
          console.error("Live session error", err);
          this.stopSession();
        },
      },
    });
  }

  private startAudioInput() {
    if (!this.inputAudioContext || !this.stream) return;

    this.sourceNode = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.gainNode = this.inputAudioContext.createGain();
    this.gainNode.gain.value = 1.5; // Boost user volume so she hears you clearly
    
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (this.isMuted) return;

      const inputData = e.inputBuffer.getChannelData(0);
      
      // Volume calculation for UI
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      if (this.onVolumeChange) {
        this.onVolumeChange(rms);
      }

      this.sendRealtimeInput(inputData);
    };

    this.sourceNode.connect(this.gainNode);
    this.gainNode.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private sendRealtimeInput(inputData: Float32Array) {
      const pcmBlob = this.createBlob(inputData);
      this.sessionPromise?.then((session) => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
  }

  private async handleServerMessage(message: LiveServerMessage) {
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio) {
      if (!this.outputAudioContext) return;
      
      // Ensure audio context is active (Mobile browsers sometimes suspend it)
      if (this.outputAudioContext.state === 'suspended') {
        await this.outputAudioContext.resume();
      }

      if (this.onIsSpeakingChange) this.onIsSpeakingChange(true);

      // Clean base64 string
      const cleanBase64 = base64Audio.replace(/\s/g, '');

      try {
        // Sync timing to handle potential clock drifts or initial delays
        this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);

        const audioBuffer = await this.decodeAudioData(
            this.decode(cleanBase64),
            this.outputAudioContext,
            24000,
            1
        );

        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;

        // Connect through Analyser if available
        if (this.outputAnalyser) {
            source.connect(this.outputAnalyser);
            this.outputAnalyser.connect(this.outputAudioContext.destination);
        } else {
            source.connect(this.outputAudioContext.destination);
        }
        
        source.addEventListener('ended', () => {
            this.sources.delete(source);
            if (this.sources.size === 0 && this.onIsSpeakingChange) {
                this.onIsSpeakingChange(false);
            }
        });

        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
        this.sources.add(source);
        
        // Start Analysis Loop if not active
        if (!this.animationFrameId) {
            this.analyzeOutput();
        }

      } catch (e) {
          console.error("Audio decode error", e);
      }
    }

    if (message.serverContent?.interrupted) {
      this.sources.forEach((s) => s.stop());
      this.sources.clear();
      this.nextStartTime = 0;
      if (this.onIsSpeakingChange) this.onIsSpeakingChange(false);
    }
  }

  private analyzeOutput = () => {
    this.animationFrameId = requestAnimationFrame(this.analyzeOutput);

    if (!this.outputAnalyser) return;

    const bufferLength = this.outputAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.outputAnalyser.getByteFrequencyData(dataArray);

    // 1. Calculate general volume (lower frequencies are voice dominant)
    let sum = 0;
    // Voice range typically < 3000Hz. FFT size 512, sample rate 24000.
    // Bin width ~ 46Hz. 3000Hz is around bin 65.
    const voiceBins = Math.min(bufferLength, 80); 
    for (let i = 0; i < voiceBins; i++) {
        sum += dataArray[i];
    }
    const average = sum / voiceBins;
    const volume = Math.min(1, average / 128); 

    if (this.onOutputVolumeChange) {
        this.onOutputVolumeChange(volume);
    }

    // 2. Frequency Data for Visualizer
    if (this.onFrequencyData) {
        // Create 20 bands from the voice range
        const numBands = 20;
        const bands: number[] = [];
        const step = Math.floor(voiceBins / numBands);
        
        for (let i = 0; i < numBands; i++) {
            let bandSum = 0;
            for (let j = 0; j < step; j++) {
                bandSum += dataArray[i * step + j];
            }
            const bandVal = bandSum / step;
            bands.push(bandVal / 255); // Normalize 0-1
        }
        this.onFrequencyData(bands);
    }
  };

  public setMute(muted: boolean) {
      this.isMuted = muted;
  }

  public async stopSession() {
    if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
    }

    this.sources.forEach(s => s.stop());
    this.sources.clear();

    if (this.processor) {
        this.processor.disconnect();
        this.processor = null;
    }
    if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
    }
    if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
    }
    if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
    }
    if (this.inputAudioContext) {
        await this.inputAudioContext.close();
        this.inputAudioContext = null;
    }
    if (this.outputAudioContext) {
        await this.outputAudioContext.close();
        this.outputAudioContext = null;
        this.outputAnalyser = null;
    }
    this.sessionPromise = null;

    if (this.onDisconnect) {
        this.onDisconnect();
    }
  }

  private createBlob(data: Float32Array): { data: string; mimeType: string } {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      const clamped = Math.max(-1, Math.min(1, data[i]));
      int16[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
    }
    const uint8 = new Uint8Array(int16.buffer);
    return {
      data: this.encode(uint8),
      mimeType: 'audio/pcm;rate=16000',
    };
  }

  private encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private decode(base64: string) {
    // Ensure clean base64 string
    const cleanBase64 = base64.replace(/\s/g, '');
    const binaryString = atob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private async decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number
  ): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
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

export const liveService = new LiveService();