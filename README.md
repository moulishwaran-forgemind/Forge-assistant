# Forge Assistant

A voice-first AI assistant powered by the **Google Gemini Live API**, built with React + Vite. Talk to Forge naturally — it listens, thinks, and responds with speech-like animated feedback.

![Forge AI](public/vite.svg)

---

## Features

- **Voice conversation** — speak naturally, Forge captures and transcribes in real time
- **Gemini Live API** — WebSocket-based bidirectional audio with the `gemini-2.5-flash-native-audio-preview` model
- **Text fallback** — if Live API audio is unavailable, responses come via the REST Gemini API
- **Speech-reactive logo** — the Forge logo breathes big/small with natural speech rhythm (syllables, word gaps, sentence pauses) while the assistant responds
- **Tone-reactive glow** — the logo background tints red and radiates a glow proportional to audio amplitude
- **Eye tracking** — the logo's eyes follow your mouse cursor (or hand via MediaPipe)
- **Logo animation modes** — Float, Mouse Track, Float+Track, Follow, Hand Track
- **Tool use** — Forge can open apps, search Google/YouTube, control system volume, and query a Clawdbot agent
- **Tanglish responses** — replies in Tamil+English mix using Roman letters by default (configurable in `live-api.js`)

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A **Google AI Studio API key** with access to Gemini models
  - Get one free at [aistudio.google.com](https://aistudio.google.com/app/apikey)
- Windows OS (the bridge server uses Windows `start` command and PowerShell for system controls)

---

## Setup & Run

### 1. Clone the repo

```bash
git clone https://github.com/moulishwaran-forgemind/Forge-assistant.git
cd Forge-assistant
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the bridge server

The bridge server runs on **port 3001** and handles system-level commands (open apps, volume control).

```bash
node bridge/server.js
```

You should see:
```
Forge Bridge running at http://localhost:3001
```

### 4. Start the frontend

Open a **second terminal** in the same folder:

```bash
npm run dev
```

You should see:
```
VITE ready in Xms
➜  Local:   http://localhost:5173/
```

### 5. Open the app

Go to [http://localhost:5173](http://localhost:5173) in your browser.

---

## Adding your API Key

1. Click the **API KEY** button in the bottom bar
2. Paste your Google AI Studio API key
3. The key is saved automatically in `localStorage` — you only need to do this once

---

## Usage

| Action | Result |
|--------|--------|
| Click **Talk to Forge AI** | Starts a voice session, opens chat panel |
| Speak naturally | Forge listens and transcribes in real time |
| Wait after speaking | Forge responds (logo breathes with speech rhythm) |
| Click **Stop** | Ends the session |
| Hover mouse over logo | Eyes track your cursor |
| Click mode buttons | Switch logo animation (Float / Mouse Track / Follow / Hand Track) |

### Voice Commands (examples)

- *"Open Notepad"* — opens Notepad via the bridge server
- *"Search for Tamil songs on YouTube"* — opens YouTube search
- *"Mute the volume"* — toggles system mute
- *"Set volume to 50"* — sets system volume

---

## Project Structure

```
Forge-assistant/
├── bridge/
│   └── server.js          # Express bridge server (port 3001) — system commands
├── src/
│   ├── lib/
│   │   ├── live-api.js    # Gemini Live API WebSocket client
│   │   └── tools.js       # Tool declarations & handlers for Gemini
│   ├── App.jsx            # Main app component — voice logic, logo animation
│   ├── App.css            # All styles
│   └── main.jsx           # React entry point
├── index.html
├── vite.config.js
└── package.json
```

---

## Configuration

### Change the AI language / personality

Edit the `systemInstruction` in [src/lib/live-api.js](src/lib/live-api.js):

```js
text: 'You are Forge, a concise and useful AI assistant. ...'
```

### Change the voice

Edit `voiceName` in [src/lib/live-api.js](src/lib/live-api.js):

```js
prebuiltVoiceConfig: { voiceName: 'Puck' }
```

Available voices: `Puck`, `Charon`, `Kore`, `Fenrir`, `Aoede`

### Change the Gemini model

Edit the constructor default in [src/lib/live-api.js](src/lib/live-api.js):

```js
constructor(apiKey, model = 'gemini-2.5-flash-native-audio-preview-12-2025')
```

### Disable continuous listening (stop after each reply)

In [src/App.jsx](src/App.jsx), set:

```js
const CONTINUOUS_MODE = false;
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| **Connection failed (1006)** | API key is invalid or doesn't have Live API access |
| **Connection timeout** | Network blocked — check firewall for `generativelanguage.googleapis.com` |
| **Bridge server not running** | Start `node bridge/server.js` in a separate terminal |
| **Microphone error** | Allow microphone access in browser settings |
| **Speech recognition not available** | Use Chrome or Edge (Firefox doesn't support Web Speech API) |
| **Logo not animating** | Make sure you're in RESPONDING state — click Talk, speak, then wait for reply |

---

## Tech Stack

- **React 19** + **Vite 7**
- **Gemini Live API** (WebSocket BidiGenerateContent)
- **Web Speech API** (speech recognition)
- **Web Audio API** (mic capture + audio playback)
- **MediaPipe Hands** (hand tracking mode)
- **Express** (bridge server for system commands)
- **Tailwind Merge** + **Lucide React** (UI utilities)

---

## License

MIT
