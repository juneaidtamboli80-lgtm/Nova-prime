
import { GoogleGenAI, Modality, Type } from '@google/genai';
import { registerPlugin } from '@capacitor/core';
import { AudioStreamer } from './AudioStreamer';

export type NovaState =
  | 'disconnected'
  | 'connecting'
  | 'listening'
  | 'speaking';

export type Persona = 'female' | 'male';

interface DeviceControlPlugin {
  openApp(options: { appName: string }): Promise<void>;
  searchYouTube(options: { query: string }): Promise<void>;
}

const DeviceControl =
  registerPlugin<DeviceControlPlugin>('DeviceControl');

const model =
  import.meta.env.VITE_GEMINI_MODEL ||
  'gemini-3.1-flash-live-preview';

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
    const key = import.meta.env.VITE_GEMINI_API_KEY;

    if (!key || key.includes('PASTE_YOUR')) {
      throw new Error(
        'Gemini API key missing. Check your .env configuration.'
      );
    }

    this.stopped = false;
    this.state('connecting');

    this.audio = new AudioStreamer((data) =>
      this.session?.sendRealtimeInput({
        audio: {
          data,
          mimeType: 'audio/pcm;rate=16000'
        }
      })
    );

    const ai = new GoogleGenAI({ apiKey: key });
    const voice = persona === 'female' ? 'Kore' : 'Puck';

    const style =
      persona === 'female'
        ? 'a warm, confident, witty female assistant'
        : 'a friendly, confident, witty male assistant';

    this.session = await ai.live.connect({
      model,
      config: {
        responseModalities: [Modality.AUDIO],

        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice
            }
          }
        },

        systemInstruction: `
You are NOVA, ${style}.

LANGUAGE RULES:
1. Understand Hindi, English and Hinglish naturally.
2. Reply in the same language the user speaks.
3. If the user speaks Hindi, reply in Hindi.
4. If the user speaks English, reply in English.
5. If the user speaks Hinglish, reply naturally in Hinglish.
6. Switch languages whenever the user switches.
7. Never force the user to speak only English.
8. Keep replies natural, friendly, concise and conversational.

DEVICE COMMANDS:
You can use tools to open installed Android apps and search YouTube.

When the user asks to open an app, use openAndroidApp.
Examples:
- WhatsApp kholo.
- Open WhatsApp.
- YouTube chalao.
- Chrome kholo.
- Open Settings.

When the user asks to search for a song or video on YouTube,
use searchYouTube.
Examples:
- Arijit Singh ke songs search karo.
- Search YouTube for relaxing music.
- YouTube par Kesariya song dhundo.

Use the exact app display name when calling openAndroidApp.
Do not claim an action succeeded unless the tool confirms it.

Be emotionally intelligent, warm, playful and helpful.
Never pretend that an app was opened if the tool failed.
`,

        tools: [
          {
            functionDeclarations: [
              {
                name: 'openAndroidApp',
                description:
                  'Open an installed Android app by its visible app name.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    appName: {
                      type: Type.STRING,
                      description:
                        'Visible app name, for example WhatsApp, YouTube, Chrome or Settings.'
                    }
                  },
                  required: ['appName']
                }
              },
              {
                name: 'searchYouTube',
                description:
                  'Search YouTube for a song, artist, music or video.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    query: {
                      type: Type.STRING,
                      description:
                        'The song, artist or video to search for.'
                    }
                  },
                  required: ['query']
                }
              }
            ]
          }
        ]
      },

      callbacks: {
        onopen: async () => {
          if (this.stopped) return;

          try {
            await this.audio?.start();
            this.state('listening');
            this.notice(
              'NOVA is listening. Hindi, English and Hinglish supported.'
            );
          } catch (e) {
            this.error(
              e instanceof Error
                ? e.message
                : 'Microphone permission required.'
            );
            await this.disconnect();
          }
        },

        onmessage: (message: any) => {
          void this.message(message);
        },

        onerror: (e: any) => {
          this.error(e?.message || 'Gemini Live API error');
        },

        onclose: () => {
          if (!this.stopped) {
            this.state('disconnected');
          }
        }
      }
    });
  }

  private async message(message: any) {
    if (message.serverContent?.interrupted) {
      this.audio?.interrupt();
      this.state('listening');
    }

    for (
      const part of
      message.serverContent?.modelTurn?.parts || []
    ) {
      if (
        part.inlineData?.data &&
        part.inlineData.mimeType?.startsWith('audio/')
      ) {
        this.state('speaking');
        this.audio?.play(part.inlineData.data);
      }
    }

    if (message.serverContent?.turnComplete) {
      this.state('listening');
    }

    const calls = message.toolCall?.functionCalls;

    if (!calls?.length) return;

    const functionResponses = await Promise.all(
      calls.map(async (call: any) => {
        try {
          if (call.name === 'openAndroidApp') {
            const appName = String(
              call.args?.appName || ''
            ).trim();

            if (!appName) {
              throw new Error('App name is missing.');
            }

            await DeviceControl.openApp({ appName });

            this.notice(`${appName} opened successfully.`);

            return {
              id: call.id,
              name: call.name,
              response: {
                result: `${appName} opened successfully.`
              }
            };
          }

          if (call.name === 'searchYouTube') {
            const query = String(
              call.args?.query || ''
            ).trim();

            if (!query) {
              throw new Error('Search query is missing.');
            }

            await DeviceControl.searchYouTube({ query });

            this.notice(`Searching YouTube for ${query}.`);

            return {
              id: call.id,
              name: call.name,
              response: {
                result: `YouTube search opened for ${query}.`
              }
            };
          }

          return {
            id: call.id,
            name: call.name,
            response: {
              error: 'Unknown command.'
            }
          };
        } catch (e) {
          const reason =
            e instanceof Error
              ? e.message
              : 'Action failed.';

          this.error(reason);

          return {
            id: call.id,
            name: call.name,
            response: {
              error: reason
            }
          };
        }
      })
    );

    this.session?.sendToolResponse({
      functionResponses
    });
  }

  async disconnect() {
    this.stopped = true;

    await this.audio?.stop();
    this.audio = undefined;

    try {
      this.session?.close();
    } catch {
      // Session may already be closed.
    }

    this.session = undefined;
    this.state('disconnected');
  }
}

