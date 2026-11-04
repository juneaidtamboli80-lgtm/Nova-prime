
const GEMINI_KEY = 'nova.geminiApiKey';
const ELEVEN_KEY = 'nova.elevenLabsApiKey';
const VOICE_ID = 'nova.elevenLabsVoiceId';

function read(key: string): string {
  try {
    return localStorage.getItem(key)?.trim() || '';
  } catch {
    return '';
  }
}

function write(key: string, value: string) {
  const v = value.trim();
  if (v) localStorage.setItem(key, v);
  else localStorage.removeItem(key);
}

// Gemini
export function getKey(): string {
  const saved = read(GEMINI_KEY);
  if (saved) return saved;

  const env = import.meta.env.VITE_GEMINI_API_KEY || '';
  return env.includes('PASTE_YOUR') ? '' : env.trim();
}

export function saveKey(value: string) {
  write(GEMINI_KEY, value);
}

// ElevenLabs
export function getElevenKey(): string {
  return read(ELEVEN_KEY);
}

export function saveElevenKey(value: string) {
  write(ELEVEN_KEY, value);
}

// ElevenLabs Voice ID
export function getVoiceId(): string {
  return read(VOICE_ID);
}

export function saveVoiceId(value: string) {
  write(VOICE_ID, value);
}

// Common helpers
export function maskKey(value: string): string {
  if (!value) return '';
  return value.length <= 8
    ? '••••'
    : value.slice(0, 4) + '••••' + value.slice(-4);
}

export async function testKey(value: string): Promise<string> {
  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
      {
        headers: {
          'x-goog-api-key': value.trim()
        }
      }
    );

    if (response.ok) return 'Gemini key valid ✓';
    if (response.status === 400 || response.status === 403) {
      return 'Gemini key invalid ya permission nahi hai.';
    }
    return 'Gemini error: ' + response.status;
  } catch {
    return 'Network error. Internet check karo.';
  }
}

export async function testElevenKey(value: string): Promise<string> {
  try {
    const response = await fetch(
      'https://api.elevenlabs.io/v1/user',
      {
        headers: {
          'xi-api-key': value.trim()
        }
      }
    );

    if (response.ok) return 'ElevenLabs API key valid ✓';
    if (response.status === 401 || response.status === 403) {
      return 'ElevenLabs key invalid ya access denied.';
    }
    return 'ElevenLabs error: ' + response.status;
  } catch {
    return 'Network error. Internet check karo.';
  }
}

export async function testVoiceId(
  key: string,
  voiceId: string
): Promise<string> {
  if (!key.trim()) return 'Pehle ElevenLabs API key save karo.';
  if (!voiceId.trim()) return 'Voice ID enter karo.';

  try {
    const response = await fetch(
      'https://api.elevenlabs.io/v1/voices/' +
        encodeURIComponent(voiceId.trim()),
      {
        headers: {
          'xi-api-key': key.trim()
        }
      }
    );

    if (response.ok) return 'Voice ID valid ✓';
    if (response.status === 404) return 'Voice ID nahi mila.';
    if (response.status === 401 || response.status === 403) {
      return 'API key access denied.';
    }
    return 'Voice error: ' + response.status;
  } catch {
    return 'Network error. Internet check karo.';
  }
}

