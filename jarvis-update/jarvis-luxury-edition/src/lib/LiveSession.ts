import { GoogleGenAI, Modality, Type } from '@google/genai';
import { AudioStreamer } from './AudioStreamer';
import { getKey } from './keyStore';

export type NovaState = 'disconnected' | 'connecting' | 'listening' | 'speaking';
export type Persona = 'female' | 'male';

const model = import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.1-flash-live-preview';

export class LiveSession {
  private session: any;
  private audio?: AudioStreamer;
  private stopped = false;

  constructor(
    private state: (s: NovaState) => void,
    private error: (s: string) => void,
    private notice: (s: string) => void
  ) {}

  async connect(persona: Persona) {
    const key = getKey();
    if (!key) throw new Error('Gemini API key missing. Open Settings → API Key and save your key.');

    this.stopped = false;
    this.state('connecting');
    this.audio = new AudioStreamer(data =>
      this.session?.sendRealtimeInput({ audio: { data, mimeType: 'audio/pcm;rate=16000' } })
    );

    const ai = new GoogleGenAI({ apiKey: key });
    const voice = persona === 'female' ? 'Kore' : 'Puck';
    const style = persona === 'female'
      ? 'a warm, confident, expressive female voice assistant'
      : 'a calm, confident, friendly male voice assistant';

    this.session = await ai.live.connect({
      model,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        systemInstruction: `You are JARVIS, a polished personal AI voice assistant with ${style}.
Speak naturally and concisely. Support both Hindi and English, including Hinglish.
Reply in the same language the user uses; if they mix Hindi and English, respond naturally in Hinglish.
Address the user respectfully as sir when appropriate. Be helpful, composed, intelligent and lightly witty.
Do not claim to control phone settings or launch apps unless the relevant tool actually succeeds.
Avoid explicit content.`,
        tools: [{
          functionDeclarations: [{
            name: 'openWebsite',
            description: 'Open a public HTTPS website in the browser',
            parameters: {
              type: Type.OBJECT,
              properties: { url: { type: Type.STRING, description: 'Full HTTPS URL' } },
              required: ['url']
            }
          }]
        }]
      },
      callbacks: {
        onopen: async () => {
          if (this.stopped) return;
          try {
            await this.audio?.start();
            this.state('listening');
            this.notice('JARVIS is listening. Speak in Hindi or English.');
          } catch (e) {
            this.error(e instanceof Error ? e.message : 'Microphone permission required.');
            await this.disconnect();
          }
        },
        onmessage: (message: any) => this.message(message),
        onerror: (e: any) => this.error(e?.message || 'Gemini Live API error.'),
        onclose: () => {
          if (!this.stopped) this.state('disconnected');
        }
      }
    });
  }

  private message(message: any) {
    if (message.serverContent?.interrupted) {
      this.audio?.interrupt();
      this.state('listening');
    }

    for (const part of message.serverContent?.modelTurn?.parts || []) {
      if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('audio/')) {
        this.state('speaking');
        this.audio?.play(part.inlineData.data);
      }
    }

    if (message.serverContent?.turnComplete) this.state('listening');

    if (message.toolCall?.functionCalls?.length) {
      const functionResponses = message.toolCall.functionCalls.map((call: any) => {
        let result = 'Action failed.';
        if (call.name === 'openWebsite') {
          try {
            const url = new URL(String(call.args?.url || ''));
            if (url.protocol === 'https:' && url.hostname.includes('.')) {
              window.open(url.href, '_blank', 'noopener,noreferrer');
              result = 'Website open request sent to browser.';
            } else {
              result = 'Only valid HTTPS URLs are allowed.';
            }
          } catch {
            result = 'Invalid URL.';
          }
        }
        return { id: call.id, name: call.name, response: { result } };
      });
      this.session?.sendToolResponse({ functionResponses });
    }
  }

  async disconnect() {
    this.stopped = true;
    await this.audio?.stop();
    this.audio = undefined;
    try { this.session?.close(); } catch { /* ignore close race */ }
    this.session = undefined;
    this.state('disconnected');
  }
}
