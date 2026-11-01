# NOVA AI — Termux Android build

React + TypeScript + Vite + Tailwind + Capacitor + Gemini Live voice assistant.
- Audio-only Live API response modality.
- Microphone downsampled to mono PCM16 16kHz.
- Audio output played as PCM16 24kHz with Web Audio.
- Female / male voice presets (Kore / Puck).
- Function calling: openWebsite (HTTPS only).
- Animated mobile UI and permission settings.

## Important
This starter embeds the API key into the client build. Use only for personal testing. Do not publish/share the APK or commit `.env`. Anyone extracting the APK may recover the key. For public release, use a backend to issue short-lived ephemeral tokens. Model access may vary by account/project/region; verify `gemini-3.1-flash-live-preview` is enabled in your Google AI Studio project.

The manifest workflow declares camera, microphone, photos/videos, notifications, contacts, location and phone permissions. Runtime request flows are included for microphone, camera/photos, location and notifications. Contacts and Phone are declared but not implemented; Android dangerous permissions still require runtime approval and must only be requested when their feature is implemented. The app does not read contacts or place calls.

## Termux steps (phone only)

1. Install Termux from F-Droid. Then:
```bash
pkg update -y && pkg upgrade -y
pkg install -y git nodejs-lts unzip nano
node -v
npm -v
termux-setup-storage
```

2. Download `nova-ai-source.zip` from this ChatGPT reply into your phone's Downloads folder. In Termux:
```bash
cd ~
cp /sdcard/Download/nova-ai-source.zip .
unzip nova-ai-source.zip
cd nova-ai
```
If the filename differs, run `ls /sdcard/Download` and adjust the `cp` command.

3. Create local `.env`:
```bash
nano .env
```
Paste:
```env
VITE_GEMINI_API_KEY=YOUR_REAL_GEMINI_API_KEY
VITE_GEMINI_MODEL=gemini-3.1-flash-live-preview
```
Save nano with CTRL+O, Enter, CTRL+X. Get the key from Google AI Studio. Never commit `.env`.

4. Install and test:
```bash
npm install
npm run build
npm run dev -- --host 0.0.0.0
```
Open `http://127.0.0.1:5173` in Chrome. Stop with CTRL+C. Browser microphone permission generally requires localhost or HTTPS.

5. Create a NEW empty GitHub repository named `nova-ai`. Do not initialize it with README. Then:
```bash
git init
git add .
git commit -m "Initial NOVA AI voice assistant"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nova-ai.git
git push -u origin main
```
Replace `YOUR_USERNAME` with your GitHub username. GitHub HTTPS authentication requires a Personal Access Token, not your normal account password.

6. GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
- Name: `GEMINI_API_KEY`
- Value: your Gemini API key
Save it.

7. GitHub repo → Actions → Build NOVA Android APK → Run workflow. Or pushing to `main` triggers it.

8. After green success: open latest workflow run → Artifacts → `nova-ai-debug-apk` → download and extract ZIP → install `app-debug.apk`. Allow Android's install prompt.

9. Launch NOVA AI → Settings → Allow Microphone → choose Female/Male → tap central power button → speak.

## Troubleshooting
- API key error: secret must be named exactly `GEMINI_API_KEY`; rerun workflow after saving.
- Model unavailable: confirm Live API access for the model in AI Studio, then change `VITE_GEMINI_MODEL` in workflow.
- Mic denied: Android Settings → Apps → NOVA AI → Permissions → Microphone → Allow.
- Contacts/Phone: currently declared only; not used by the app.
- Keep the app foreground; always-on background listening is not implemented.
