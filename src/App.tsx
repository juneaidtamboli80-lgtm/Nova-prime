import { useEffect, useRef, useState } from 'react';
import {
  Activity, Camera, Contact, Globe, MapPin, Mic, MicOff, Phone, Power,
  Settings, Sparkles, Volume2, X, ShieldCheck, KeyRound, Eye, EyeOff,
  Clock3, CloudSun, Youtube, MessageCircle, Chrome, Map, Smartphone,
  Wifi, Bell, Image as ImageIcon, ChevronRight, RefreshCw, ExternalLink
} from 'lucide-react';
import { getKey, saveKey, testKey, maskKey } from './lib/keyStore';
import { Camera as NativeCamera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LiveSession, NovaState, Persona } from './lib/LiveSession';

type DeviceControlPlugin = {
  requestNativePermission(options: { permission: string }): Promise<{ permission: string; granted: boolean }>;
  openApp?(options: { appName: string }): Promise<{ opened?: boolean; message?: string }>;
};
const DeviceControl = registerPlugin<DeviceControlPlugin>('DeviceControl');

const labels: Record<NovaState, string> = {
  disconnected: 'SYSTEM STANDBY',
  connecting: 'ESTABLISHING LIVE LINK',
  listening: 'LISTENING FOR COMMAND',
  speaking: 'JARVIS IS RESPONDING'
};

const apps = [
  { name: 'YouTube', id: 'youtube', Icon: Youtube },
  { name: 'WhatsApp', id: 'whatsapp', Icon: MessageCircle },
  { name: 'Chrome', id: 'chrome', Icon: Chrome },
  { name: 'Maps', id: 'maps', Icon: Map },
  { name: 'Phone', id: 'phone', Icon: Phone },
  { name: 'Settings', id: 'settings', Icon: Settings }
];

const permissionItems = [
  ['camera', 'Camera', Camera],
  ['microphone', 'Microphone', Mic],
  ['photos', 'Photos & videos', ImageIcon],
  ['notifications', 'Notifications', Bell],
  ['contacts', 'Contacts', Contact],
  ['location', 'Location', MapPin],
  ['phone', 'Phone', Phone]
] as const;

function getLocalTime() {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}
function getLocalDate() {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date());
}

export default function App() {
  const [state, setState] = useState<NovaState>('disconnected');
  const [persona, setPersona] = useState<Persona>('female');
  const [settings, setSettings] = useState(false);
  const [notice, setNotice] = useState('At your service. Tap the core to begin.');
  const [error, setError] = useState('');
  const [perm, setPerm] = useState<Record<string, string>>({});
  const [apiKey, setApiKey] = useState(getKey());
  const [showKey, setShowKey] = useState(false);
  const [keyMsg, setKeyMsg] = useState('');
  const [saved, setSaved] = useState(getKey());
  const [tab, setTab] = useState<'home' | 'apps' | 'devices'>('home');
  const [clock, setClock] = useState(getLocalTime());
  const [date, setDate] = useState(getLocalDate());
  const [weather, setWeather] = useState('Weather not loaded');
  const [weatherBusy, setWeatherBusy] = useState(false);

  const live = useRef<LiveSession | null>(null);
  const busy = state !== 'disconnected';

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(getLocalTime());
      setDate(getLocalDate());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => { void live.current?.disconnect(); }, []);

  function onSaveKey() {
    try {
      saveKey(apiKey);
      setSaved(apiKey.trim());
      setKeyMsg(apiKey.trim() ? 'Saved ✓ You can start your voice session.' : 'API key cleared.');
    } catch {
      setKeyMsg('Unable to save the key.');
    }
  }

  async function onTestKey() {
    if (!apiKey.trim()) { setKeyMsg('Paste your Gemini API key first.'); return; }
    setKeyMsg('Testing key…');
    const result = await testKey(apiKey);
    setKeyMsg(result === 'ok' ? 'API key is valid ✓' : result);
  }

  async function toggleSession() {
    setError('');
    if (busy) {
      await live.current?.disconnect();
      live.current = null;
      return;
    }
    try {
      live.current = new LiveSession(setState, setError, setNotice);
      await live.current.connect(persona);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to connect to Gemini Live.');
      setState('disconnected');
      await live.current?.disconnect();
      live.current = null;
    }
  }

  async function request(permission: string) {
    try {
      if (!Capacitor.isNativePlatform()) {
        if (permission === 'microphone') {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
        } else if (permission === 'location') {
          await new Promise<void>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(() => resolve(), reject)
          );
        } else {
          setPerm(p => ({ ...p, [permission]: 'Manage this permission in browser or Android settings.' }));
          return;
        }
      } else if (permission === 'camera' || permission === 'photos') {
        const result = await NativeCamera.requestPermissions({
          permissions: permission === 'camera' ? ['camera'] : ['photos']
        });
        setPerm(p => ({ ...p, [permission]: JSON.stringify(result) }));
        return;
      } else if (permission === 'location') {
        const result = await Geolocation.requestPermissions();
        setPerm(p => ({ ...p, [permission]: JSON.stringify(result) }));
        return;
      } else if (permission === 'notifications') {
        const result = await LocalNotifications.requestPermissions();
        setPerm(p => ({ ...p, [permission]: JSON.stringify(result) }));
        return;
      } else if (permission === 'microphone' || permission === 'contacts' || permission === 'phone') {
        const result = await DeviceControl.requestNativePermission({ permission });
        setPerm(p => ({ ...p, [permission]: result.granted ? 'Allowed ✓' : 'Not granted — check Android App permissions.' }));
        return;
      } else {
        setPerm(p => ({ ...p, [permission]: 'Not supported by this app yet.' }));
        return;
      }
      setPerm(p => ({ ...p, [permission]: 'Permission request completed.' }));
    } catch (e) {
      setPerm(p => ({ ...p, [permission]: e instanceof Error ? e.message : 'Permission denied.' }));
    }
  }

  async function openApp(appName: string) {
    try {
      if (!Capacitor.isNativePlatform() || !DeviceControl.openApp) {
        setNotice(`App Launcher requires the Android DeviceControl native plugin (${appName}).`);
        return;
      }
      const result = await DeviceControl.openApp({ appName });
      setNotice(result.message || (result.opened ? `${appName} opened.` : `Requested ${appName}.`));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : `Could not open ${appName}.`);
    }
  }

  async function loadWeather() {
    setWeatherBusy(true);
    setWeather('Getting device location…');
    try {
      let latitude: number;
      let longitude: number;
      if (Capacitor.isNativePlatform()) {
        const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 12000 });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } else {
        const position = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 12000 })
        );
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,weather_code&timezone=auto`
      );
      if (!response.ok) throw new Error('Weather service unavailable.');
      const data = await response.json();
      const current = data.current;
      const descriptions: Record<number, string> = {
        0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
        45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle',
        55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
        71: 'Light snow', 80: 'Rain showers', 81: 'Showers', 82: 'Heavy showers',
        95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm'
      };
      const description = descriptions[current.weather_code] || 'Current conditions';
      setWeather(`${Math.round(current.temperature_2m)}°C · ${description}`);
    } catch (e) {
      setWeather(e instanceof Error ? e.message : 'Unable to load weather. Allow location access.');
    } finally {
      setWeatherBusy(false);
    }
  }

  return (
    <main className="lux-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={19} /></div>
          <div><b>J.A.R.V.I.S.</b><small>PERSONAL INTELLIGENCE</small></div>
        </div>
        <button className="icon-button" aria-label="Open settings" onClick={() => setSettings(true)}><Settings size={19} /></button>
      </header>

      <section className="system-strip">
        <span className={`status-dot ${state}`} />
        <span>{labels[state]}</span>
        <span className="strip-right"><ShieldCheck size={13} /> SECURE LINK</span>
      </section>

      <section className="clock-weather">
        <div className="clock-card">
          <span className="eyebrow">LOCAL TIME</span>
          <strong>{clock}</strong>
          <small>{date}</small>
        </div>
        <button className="weather-card" onClick={loadWeather} disabled={weatherBusy}>
          <span className="weather-icon"><CloudSun size={22} /></span>
          <span><small className="eyebrow">LIVE WEATHER</small><b>{weatherBusy ? 'Updating…' : weather}</b></span>
          <RefreshCw className={weatherBusy ? 'spin' : ''} size={14} />
        </button>
      </section>

      <section className="hero">
        <div className={`orb-stage ${state}`}>
          <div className="orb-halo halo-one" />
          <div className="orb-halo halo-two" />
          <div className="orb-orbit orbit-one" />
          <div className="orb-orbit orbit-two" />
          <div className="orb-orbit orbit-three" />
          <div className="orb-core"><div className="orb-shine" /><Sparkles size={32} strokeWidth={1.2} /></div>
          <div className="orb-particles"><i /><i /><i /><i /><i /><i /></div>
        </div>
        <div className="hero-title">At your service<span>.</span></div>
        <p className="hero-subtitle">
          {state === 'listening' ? 'I’m listening. Go ahead, sir.' :
           state === 'speaking' ? 'One moment. I’m on it.' :
           state === 'connecting' ? 'Establishing a secure voice connection…' :
           'Intelligence, refined. Ready when you are.'}
        </p>
        <div className={`voice-wave ${busy ? 'active' : ''}`} aria-label="Voice activity animation">
          {Array.from({ length: 35 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 0.035}s` }} />)}
        </div>
        <button className={`core-button ${busy ? 'active' : ''}`} onClick={toggleSession} aria-label={busy ? 'End voice session' : 'Start voice session'}>
          {busy ? <MicOff size={23} /> : <Power size={23} />}
        </button>
        <small className="core-caption">{busy ? 'TAP TO END SESSION' : 'TAP TO INITIATE VOICE'}</small>
        <div className="voice-selector">
          <button className={persona === 'female' ? 'selected' : ''} disabled={busy} onClick={() => setPersona('female')}>FEMALE VOICE</button>
          <button className={persona === 'male' ? 'selected' : ''} disabled={busy} onClick={() => setPersona('male')}>MALE VOICE</button>
        </div>
        <div className="notice"><Volume2 size={14} />{notice}</div>
        {error && <div className="error-message">{error}</div>}
      </section>

      <nav className="bottom-nav">
        <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}><Sparkles size={18} /><span>CORE</span></button>
        <button className={tab === 'apps' ? 'active' : ''} onClick={() => setTab('apps')}><Smartphone size={18} /><span>APPS</span></button>
        <button className={tab === 'devices' ? 'active' : ''} onClick={() => setTab('devices')}><Activity size={18} /><span>DEVICES</span></button>
      </nav>

      {tab !== 'home' && (
        <div className="drawer-backdrop" onClick={() => setTab('home')}>
          <section className="feature-drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-heading">
              <div><small>JARVIS CONTROL</small><h2>{tab === 'apps' ? 'App launcher' : 'Device dashboard'}</h2></div>
              <button className="icon-button" onClick={() => setTab('home')}><X size={18} /></button>
            </div>
            {tab === 'apps' ? (
              <>
                <p className="drawer-copy">Launch installed apps on this Android device.</p>
                <div className="app-grid">
                  {apps.map(({ name, id, Icon }) => (
                    <button className="app-tile" key={id} onClick={() => void openApp(id)}>
                      <span><Icon size={22} /></span><b>{name}</b><ChevronRight size={14} />
                    </button>
                  ))}
                </div>
                <p className="drawer-footnote">App launching needs the native DeviceControl.openApp method and Android package visibility declarations.</p>
              </>
            ) : (
              <>
                <p className="drawer-copy">Permission shortcuts. Android keeps protected device controls under system permission settings.</p>
                <div className="device-grid">
                  {permissionItems.map(([key, label, Icon]) => (
                    <button className="device-tile" key={key} onClick={() => void request(key)}>
                      <span><Icon size={19} /></span><b>{label}</b><small>{perm[key] || 'Tap to request access'}</small>
                    </button>
                  ))}
                </div>
                <div className="device-note"><Wifi size={16} /><span>Wi-Fi, Bluetooth and other protected system switches cannot be silently toggled by a normal Android app. Use Android system controls for those actions.</span></div>
              </>
            )}
          </section>
        </div>
      )}

      {settings && (
        <div className="drawer-backdrop" onClick={() => setSettings(false)}>
          <section className="settings-drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-heading">
              <div><small>CONFIGURATION</small><h2>System settings</h2></div>
              <button className="icon-button" onClick={() => setSettings(false)}><X size={19} /></button>
            </div>
            <h3>VOICE PERSONALITY</h3>
            <div className="persona-grid">
              <button className={persona === 'female' ? 'selected' : ''} onClick={() => setPersona('female')} disabled={busy}>♀ FEMALE<small>Kore · Warm and expressive</small></button>
              <button className={persona === 'male' ? 'selected' : ''} onClick={() => setPersona('male')} disabled={busy}>♂ MALE<small>Puck · Confident and friendly</small></button>
            </div>
            <h3>GEMINI API KEY</h3>
            <div className="key-card">
              <div className="key-title"><KeyRound size={16} /><b>Google Gemini API Key</b></div>
              <small>{saved ? `Saved: ${maskKey(saved)}` : 'Required for Gemini Live voice sessions'}</small>
              <div className="key-input-row">
                <input type={showKey ? 'text' : 'password'} value={apiKey} placeholder="Paste Gemini API key" autoComplete="off" autoCapitalize="off" spellCheck={false} onChange={e => { setApiKey(e.target.value); setKeyMsg(''); }} />
                <button onClick={() => setShowKey(v => !v)} aria-label="Show or hide API key">{showKey ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
              <div className="key-actions">
                <button onClick={onSaveKey}>SAVE</button><button onClick={onTestKey}>TEST</button>
                <button onClick={() => { setApiKey(''); saveKey(''); setSaved(''); setKeyMsg('API key cleared.'); }}>CLEAR</button>
              </div>
              {keyMsg && <small className="key-message">{keyMsg}</small>}
            </div>
            <h3>ANDROID PERMISSIONS</h3>
            <p className="drawer-copy">Grant only the permissions required for features you use.</p>
            {permissionItems.map(([key, label, Icon]) => (
              <div className="permission-row" key={key}>
                <span className="permission-icon"><Icon size={17} /></span>
                <div><b>{label}</b><small>{perm[key] || 'Optional permission'}</small></div>
                <button onClick={() => void request(key)}>ALLOW</button>
              </div>
            ))}
            <p className="drawer-footnote">Contacts and Phone require the matching native permission implementation. App features that use these permissions must be implemented separately.</p>
          </section>
        </div>
      )}
    </main>
  );
}
