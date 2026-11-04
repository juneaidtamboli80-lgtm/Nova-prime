# JARVIS Luxury Black Edition UI

This package contains replacement frontend files for the existing NOVA/Capacitor project:

- `src/App.tsx`
- `src/style.css`
- `src/lib/LiveSession.ts`

## Install on your existing project

Back up your existing files first:

```bash
cd ~/nova-ai
cp src/App.tsx src/App.tsx.before-luxury
cp src/style.css src/style.css.before-luxury
cp src/lib/LiveSession.ts src/lib/LiveSession.ts.before-luxury
```

Extract this ZIP in a temporary folder, then copy the three files into the matching locations in your project.

Run:

```bash
npm run build
```

If the build succeeds:

```bash
npx cap sync android
```

## Important native Android integration

The App Launcher calls `DeviceControl.openApp({ appName })`. The registered native Capacitor plugin must expose an `openApp` method that accepts an `appName` string. The expected app IDs passed by this UI are:

- `youtube`
- `whatsapp`
- `chrome`
- `maps`
- `phone`
- `settings`

If your native plugin currently only exposes `requestNativePermission`, the launcher UI will still render but native app launching will show a notice until `openApp` is implemented in the Java plugin and registered in `MainActivity`.

The Device Dashboard requests runtime permissions. It does not silently switch protected Android system toggles such as Wi-Fi or Bluetooth; those require Android system UI / supported native APIs and user confirmation.

## Weather and clock

- Clock/date use the device's local timezone.
- Weather uses device geolocation and the Open-Meteo forecast endpoint. Tap the weather panel to request location and load current conditions. Internet access is required.

## Voice

The existing Gemini Live PCM audio pipeline is retained. The updated system instruction asks JARVIS to support Hindi, English and Hinglish and respond in the language the user uses. Voice selection remains Kore (female) and Puck (male).

Note: The existing app's `keyStore`, `AudioStreamer`, Android permissions, Capacitor plugins and environment configuration are still required.
