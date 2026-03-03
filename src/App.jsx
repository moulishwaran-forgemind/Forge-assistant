import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Settings, AlertCircle, MessageSquareText } from 'lucide-react';
import { LiveAPI } from './lib/live-api';
import { tools, toolHandlers } from './lib/tools';
import './App.css';

const UI_STATES = Object.freeze({
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING',
  RESPONDING: 'RESPONDING',
});

const CONTINUOUS_MODE = true;

// ── Animation constants (mirrors the HTML demo) ──────────────────────────────
const LC = { x: 112, y: 143.9 };
const RC = { x: 159.75, y: 143.9 };
const EYE_MAX = 5;
const EYE_LERP = 0.10;
const TILT_MAX = 50;
const TILT_LERP = 0.055;
const ORBIT_PERIOD = 28.0;
const ORBIT_RX = 0.10; // 10 % of screen width
const ORBIT_RY = 0.08; // 8 % of screen height
const FLOAT_LERP = 0.018;

function buildId(prefix = 'msg') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function computeRms(samples) {
  if (!samples?.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

function floatTo16BitPCM(float32) {
  const buf = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

function float32ToBase64Pcm16(float32) {
  const bytes = floatTo16BitPCM(float32);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function getStateTitle(state) {
  if (state === UI_STATES.LISTENING) return 'Listening';
  if (state === UI_STATES.PROCESSING) return 'Processing';
  if (state === UI_STATES.RESPONDING) return 'Responding';
  return 'Forge AI';
}

function getStateSubtitle(state) {
  if (state === UI_STATES.LISTENING) return 'Speak naturally. Forge is capturing your voice.';
  if (state === UI_STATES.PROCESSING) return 'Transcript captured. Forge is thinking.';
  if (state === UI_STATES.RESPONDING) return 'Forge is speaking. Pulse follows output energy.';
  return 'Press Talk to start a live voice conversation.';
}

// ── ForgeLogo: accepts refs for eye groups & SVG ────────────────────────────
function ForgeLogo({ eyeLRef, eyeRRef, svgRef }) {
  return (
    <div className="forge-mark" aria-hidden="true">
      <svg ref={svgRef} className="forge-svg" viewBox="0 0 270 270" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="socket-L">
            <path d="M125.1 160.759V141.079C125.1 140.378 124.733 139.729 124.133 139.367L102.033 126.03C100.7 125.226 99 126.186 99 127.743V147.804C99 148.514 99.3762 149.171 99.9886 149.53L122.089 162.485C123.422 163.266 125.1 162.305 125.1 160.759Z" />
          </clipPath>
          <clipPath id="socket-R">
            <path d="M146.7 160.759V141.079C146.7 140.378 147.067 139.729 147.667 139.367L169.767 126.03C171.1 125.226 172.8 126.186 172.8 127.743V147.804C172.8 148.514 172.424 149.171 171.811 149.53L149.711 162.485C148.378 163.266 146.7 162.305 146.7 160.759Z" />
          </clipPath>
        </defs>

        <path d="M132.5 17.2168C134.047 16.3237 135.953 16.3237 137.5 17.2168L235.753 73.9434C237.3 74.8365 238.253 76.4871 238.253 78.2734V191.727C238.253 193.513 237.3 195.163 235.753 196.057L137.5 252.783C135.953 253.676 134.047 253.676 132.5 252.783L34.2471 196.057C32.7001 195.163 31.7471 193.513 31.7471 191.727V78.2734C31.7471 76.4871 32.7001 74.8365 34.2471 73.9434L132.5 17.2168Z" fill="#111111" stroke="#111111" strokeWidth="2" strokeLinejoin="round" />
        <path d="M132.5 24C133.8 23.27 136.2 23.27 137.5 24L229.5 76.5C230.8 77.23 231.5 78.62 231.5 80.08V189.92C231.5 191.38 230.8 192.77 229.5 193.5L137.5 246C136.2 246.73 133.8 246.73 132.5 246L40.5 193.5C39.2 192.77 38.5 191.38 38.5 189.92V80.08C38.5 78.62 39.2 77.23 40.5 76.5L132.5 24Z" fill="white" />
        <path d="M132.5 50C133.8 49.27 136.2 49.27 137.5 50L207 92C208.3 92.73 209 94.12 209 95.58V174.42C209 175.88 208.3 177.27 207 178L137.5 220C136.2 220.73 133.8 220.73 132.5 220L63 178C61.7 177.27 61 175.88 61 174.42V95.58C61 94.12 61.7 92.73 63 92L132.5 50Z" fill="#111111" stroke="#111111" strokeWidth="2" strokeLinejoin="round" />
        <path d="M135.26 53.6155L101.777 73.606C100.496 74.3708 100.473 76.2184 101.735 77.0146L117.047 86.6768C117.693 87.0841 118.514 87.0886 119.163 86.6883L136.596 75.95C137.263 75.5394 138.107 75.5555 138.758 75.9912L159.388 89.8084C160.59 90.6133 160.567 92.3884 159.344 93.1609L133.581 109.437C132.953 109.834 132.157 109.85 131.513 109.478L86.897 83.729C86.2908 83.3792 85.5459 83.3717 84.9328 83.7092L65.0356 94.6617C64.3968 95.0133 64 95.6846 64 96.4138V174.378C64 175.085 64.3731 175.739 64.9814 176.099L134.336 217.145C134.966 217.518 135.75 217.517 136.378 217.142L205.274 176.1C205.879 175.739 206.25 175.087 206.25 174.382V113.114C206.25 111.568 204.57 110.606 203.236 111.39L186.715 121.105C186.104 121.464 185.729 122.12 185.729 122.829V161.881C185.729 162.57 185.374 163.21 184.791 163.576L136.396 193.895C135.759 194.294 134.952 194.303 134.307 193.916L83.6283 163.57C83.025 163.209 82.6557 162.558 82.6557 161.854V107.578C82.6557 106.024 84.3501 105.064 85.6832 105.862L134.356 135.007C134.975 135.378 135.746 135.386 136.373 135.029L203.287 96.9194C204.614 96.1634 204.638 94.2587 203.33 93.4693L137.319 53.6205C136.686 53.2386 135.895 53.2367 135.26 53.6155Z" fill="#D10D02" stroke="#111111" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M120.6 91.8L97.2 76.95L91.35 80.55L132.75 104.4L152.55 91.8L137.25 81.45L120.6 91.8Z" fill="#111111" stroke="#111111" strokeWidth="4" strokeLinejoin="round" />
        <path d="M134.442 139.793L92.1314 114.325C90.7984 113.522 89.1 114.482 89.1 116.038V157.72C89.1 158.421 89.4675 159.071 90.0685 159.433L134.392 186.113C135.041 186.504 135.854 186.495 136.493 186.09L178.619 159.439C179.199 159.072 179.55 158.434 179.55 157.749V121.732C179.55 121.03 179.919 120.379 180.521 120.017L203.329 106.333C203.931 105.971 204.3 105.32 204.3 104.618V104.258C204.3 102.719 202.636 101.757 201.303 102.524L136.47 139.813C135.841 140.175 135.064 140.168 134.442 139.793Z" fill="#111111" stroke="#111111" strokeWidth="5" strokeLinejoin="round" />
        <path d="M125.1 160.759V141.079C125.1 140.378 124.733 139.729 124.133 139.367L102.033 126.03C100.7 125.226 99 126.186 99 127.743V147.804C99 148.514 99.3762 149.171 99.9886 149.53L122.089 162.485C123.422 163.266 125.1 162.305 125.1 160.759Z" fill="#111111" />
        <path d="M146.7 160.759V141.079C146.7 140.378 147.067 139.729 147.667 139.367L169.767 126.03C171.1 125.226 172.8 126.186 172.8 127.743V147.804C172.8 148.514 172.424 149.171 171.811 149.53L149.711 162.485C148.378 163.266 146.7 162.305 146.7 160.759Z" fill="#111111" />

        {/* Left eye: outer group = eye-tracking translate, inner group = blink scaleY */}
        <g clipPath="url(#socket-L)">
          <g ref={eyeLRef}>
            <g className="blink-wrapper blink-wrapper--left">
              <path d="M125.1 160.759V141.079C125.1 140.378 124.733 139.729 124.133 139.367L102.033 126.03C100.7 125.226 99 126.186 99 127.743V147.804C99 148.514 99.3762 149.171 99.9886 149.53L122.089 162.485C123.422 163.266 125.1 162.305 125.1 160.759Z" fill="white" transform="translate(112 143.9) scale(0.93) translate(-112 -143.9)" />
            </g>
          </g>
        </g>

        {/* Right eye: same two-level structure */}
        <g clipPath="url(#socket-R)">
          <g ref={eyeRRef}>
            <g className="blink-wrapper blink-wrapper--right">
              <path d="M146.7 160.759V141.079C146.7 140.378 147.067 139.729 147.667 139.367L169.767 126.03C171.1 125.226 172.8 126.186 172.8 127.743V147.804C172.8 148.514 172.424 149.171 171.811 149.53L149.711 162.485C148.378 163.266 146.7 162.305 146.7 160.759Z" fill="white" transform="translate(159.75 143.9) scale(0.93) translate(-159.75 -143.9)" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}

// ── Logo mode button labels ──────────────────────────────────────────────────
const LOGO_MODES = [
  { key: 'float',  label: 'Float' },
  { key: 'track',  label: 'Mouse Track' },
  { key: 'both',   label: 'Float + Track' },
  { key: 'follow', label: 'Follow' },
  { key: 'hand',   label: 'Hand Track' },
];

export default function App() {
  // ── Voice state ─────────────────────────────────────────────────────────
  const [apiKey, setApiKey] = useState(localStorage.getItem('forge_api_key') || '');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [uiState, setUiState] = useState(UI_STATES.IDLE);
  const [errorMsg, setErrorMsg] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [supportsRecognition] = useState(
    () => typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  );

  // ── Logo animation mode ──────────────────────────────────────────────────
  const [logoMode, setLogoMode] = useState('float');
  const logoModeRef = useRef('float');

  // ── Logo animation refs ──────────────────────────────────────────────────
  const logoZoneRef = useRef(null);   // whole logo-zone (translate + tilt)
  const eyeLRef     = useRef(null);   // left eye g → translate for eye tracking
  const eyeRRef     = useRef(null);   // right eye g → translate for eye tracking
  const logoSvgRef  = useRef(null);   // SVG element (for svgRect)
  const animRef     = useRef({        // all animation state in one ref (no re-render)
    posX: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    posY: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
    tiltX: 0, tiltY: 0,
    lx: 0, ly: 0,
    rx: 0, ry: 0,
    mx: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    my: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
    t: Math.random() * 100,
    handX: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    handY: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
    handDetected: false,
    handInstance: null,
    handCamera: null,
    camVideo: null,
    last: 0,
  });

  // ── Voice refs ───────────────────────────────────────────────────────────
  const uiStateRef           = useRef(UI_STATES.IDLE);
  const sessionActiveRef     = useRef(false);
  const stopRequestedRef     = useRef(false);
  const transitionLockRef    = useRef(false);
  const liveApiRef           = useRef(null);
  const chatBottomRef        = useRef(null);
  const aiDraftIdRef         = useRef('');
  const recCtxRef            = useRef(null);
  const micStreamRef         = useRef(null);
  const micSourceRef         = useRef(null);
  const processorRef         = useRef(null);
  const recognitionRef       = useRef(null);
  const recognitionFinalRef  = useRef('');
  const playCtxRef           = useRef(null);
  const scheduleRef          = useRef(0);
  const outputSourcesRef     = useRef(new Set());
  const resumeListeningTimerRef  = useRef(null);
  const responseIdleTimerRef     = useRef(null);
  const startListeningCycleRef   = useRef(null);
  const textTurnRef              = useRef(0);

  // ── Logo animation RAF loop ──────────────────────────────────────────────
  useEffect(() => {
    let rafId;
    const s = animRef.current;

    function onMouseMove(e) { s.mx = e.clientX; s.my = e.clientY; }
    document.addEventListener('mousemove', onMouseMove, { passive: true });

    function getEyeTarget(c) {
      const svg = logoSvgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const sx = 270 / rect.width;
      const sy = 270 / rect.height;
      const ex = s.handDetected && logoModeRef.current === 'hand' ? s.handX : s.mx;
      const ey = s.handDetected && logoModeRef.current === 'hand' ? s.handY : s.my;
      const dx = (ex - rect.left) * sx - c.x;
      const dy = (ey - rect.top)  * sy - c.y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < 0.01) return { x: 0, y: 0 };
      const m = Math.min(d * 0.065, EYE_MAX);
      return { x: (dx / d) * m, y: (dy / d) * m };
    }

    function tick(now) {
      const dt = Math.min((now - s.last) / 1000, 0.02);
      s.last = now;

      const zone  = logoZoneRef.current;
      const eyeL  = eyeLRef.current;
      const eyeR  = eyeRRef.current;
      if (!zone || !eyeL || !eyeR) { rafId = requestAnimationFrame(tick); return; }

      const mode        = logoModeRef.current;
      const voiceActive = uiStateRef.current !== UI_STATES.IDLE;
      const cx = window.innerWidth  / 2;
      const cy = window.innerHeight / 2;

      if (voiceActive) {
        // ── Voice active: pull logo back to center ──────────────────────
        s.posX += (cx - s.posX) * 0.06;
        s.posY += (cy - s.posY) * 0.06;
        // Subtle tilt toward cursor while listening/responding
        const nx = (s.mx / window.innerWidth  - 0.5) * 2;
        const ny = (s.my / window.innerHeight - 0.5) * 2;
        s.tiltX += (-ny * TILT_MAX * 0.4 - s.tiltX) * TILT_LERP;
        s.tiltY += ( nx * TILT_MAX * 0.4 - s.tiltY) * TILT_LERP;

      } else if (mode === 'float') {
        // ── Elliptical orbit ─────────────────────────────────────────────
        s.t += dt;
        const a = (2 * Math.PI * s.t) / ORBIT_PERIOD;
        const tx = cx + Math.cos(a) * window.innerWidth  * ORBIT_RX;
        const ty = cy + Math.sin(a) * window.innerHeight * ORBIT_RY;
        s.posX += (tx - s.posX) * FLOAT_LERP;
        s.posY += (ty - s.posY) * FLOAT_LERP;
        // Gentle tilt toward cursor during float
        const nx = (s.mx / window.innerWidth  - 0.5) * 2;
        const ny = (s.my / window.innerHeight - 0.5) * 2;
        s.tiltX += (-ny * TILT_MAX * 0.4 - s.tiltX) * TILT_LERP;
        s.tiltY += ( nx * TILT_MAX * 0.4 - s.tiltY) * TILT_LERP;

      } else if (mode === 'track') {
        // ── Logo stays center, tilts toward cursor ────────────────────────
        s.posX += (cx - s.posX) * 0.06;
        s.posY += (cy - s.posY) * 0.06;
        const nx = (s.mx / window.innerWidth  - 0.5) * 2;
        const ny = (s.my / window.innerHeight - 0.5) * 2;
        s.tiltX += (-ny * TILT_MAX - s.tiltX) * TILT_LERP;
        s.tiltY += ( nx * TILT_MAX - s.tiltY) * TILT_LERP;

      } else if (mode === 'both') {
        // ── Orbit AND tilt toward cursor ──────────────────────────────────
        s.t += dt;
        const a = (2 * Math.PI * s.t) / ORBIT_PERIOD;
        const tx = cx + Math.cos(a) * window.innerWidth  * ORBIT_RX;
        const ty = cy + Math.sin(a) * window.innerHeight * ORBIT_RY;
        s.posX += (tx - s.posX) * FLOAT_LERP;
        s.posY += (ty - s.posY) * FLOAT_LERP;
        const nx = (s.mx / window.innerWidth  - 0.5) * 2;
        const ny = (s.my / window.innerHeight - 0.5) * 2;
        s.tiltX += (-ny * TILT_MAX - s.tiltX) * TILT_LERP;
        s.tiltY += ( nx * TILT_MAX - s.tiltY) * TILT_LERP;

      } else if (mode === 'follow') {
        // ── Entire logo chases cursor ─────────────────────────────────────
        s.posX += (s.mx - s.posX) * 0.06;
        s.posY += (s.my - s.posY) * 0.06;
        const nxF = ((s.mx - s.posX) / (window.innerWidth  * 0.5)) * 1.2;
        const nyF = ((s.my - s.posY) / (window.innerHeight * 0.5)) * 1.2;
        s.tiltX += (-nyF * TILT_MAX - s.tiltX) * TILT_LERP;
        s.tiltY += ( nxF * TILT_MAX - s.tiltY) * TILT_LERP;

      } else if (mode === 'hand') {
        // ── Logo chases palm (index finger tip) ───────────────────────────
        const tx = s.handDetected ? s.handX : cx;
        const ty = s.handDetected ? s.handY : cy;
        s.posX += (tx - s.posX) * 0.07;
        s.posY += (ty - s.posY) * 0.07;
        const nxH = ((tx - s.posX) / (window.innerWidth  * 0.5)) * 1.4;
        const nyH = ((ty - s.posY) / (window.innerHeight * 0.5)) * 1.4;
        s.tiltX += (-nyH * TILT_MAX - s.tiltX) * TILT_LERP;
        s.tiltY += ( nxH * TILT_MAX - s.tiltY) * TILT_LERP;
      }

      // ── Apply transform to logo-zone ────────────────────────────────────
      const offsetX = s.posX - cx;
      const offsetY = s.posY - cy;
      zone.style.transform = `translate(${offsetX.toFixed(2)}px,${offsetY.toFixed(2)}px) perspective(600px) rotateX(${s.tiltX.toFixed(3)}deg) rotateY(${s.tiltY.toFixed(3)}deg)`;

      // ── Eye tracking (always active) ────────────────────────────────────
      const tL = getEyeTarget(LC);
      const tR = getEyeTarget(RC);
      s.lx += (tL.x - s.lx) * EYE_LERP;
      s.ly += (tL.y - s.ly) * EYE_LERP;
      s.rx += (tR.x - s.rx) * EYE_LERP;
      s.ry += (tR.y - s.ry) * EYE_LERP;
      eyeL.style.transform = `translate(${s.lx.toFixed(2)}px,${s.ly.toFixed(2)}px)`;
      eyeR.style.transform = `translate(${s.rx.toFixed(2)}px,${s.ry.toFixed(2)}px)`;

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', onMouseMove);
      // Stop hand tracking camera if active
      if (s.handCamera) { try { s.handCamera.stop(); } catch { /**/ } }
    };
  }, []); // runs once on mount

  // ── Hand tracking initializer ────────────────────────────────────────────
  const initHandTracking = useCallback(() => {
    const s = animRef.current;
    if (s.handInstance) return; // already running

    const Hands  = window.Hands;
    const Camera = window.Camera;
    if (!Hands || !Camera) {
      setErrorMsg('MediaPipe not loaded. Check your internet connection.');
      return;
    }

    if (!s.camVideo) {
      s.camVideo = document.createElement('video');
      s.camVideo.setAttribute('playsinline', '');
      s.camVideo.muted = true;
    }

    s.handInstance = new Hands({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
    });
    s.handInstance.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.6,
    });
    s.handInstance.onResults((results) => {
      if (results.multiHandLandmarks?.length > 0) {
        s.handDetected = true;
        const tip = results.multiHandLandmarks[0][8]; // index finger tip
        s.handX = (1 - tip.x) * window.innerWidth;
        s.handY = tip.y * window.innerHeight;
      } else {
        s.handDetected = false;
      }
    });

    s.handCamera = new Camera(s.camVideo, {
      onFrame: async () => {
        if (logoModeRef.current === 'hand') {
          await s.handInstance.send({ image: s.camVideo });
        }
      },
      width: 320,
      height: 240,
    });
    s.handCamera.start();
  }, []);

  const stopHandTracking = useCallback(() => {
    const s = animRef.current;
    if (s.handCamera) {
      try { s.handCamera.stop(); } catch { /**/ }
      s.handCamera = null;
    }
    s.handInstance = null;
    s.handDetected = false;
  }, []);

  const switchLogoMode = useCallback((m) => {
    const prev = logoModeRef.current;
    logoModeRef.current = m;
    setLogoMode(m);

    if (m === 'hand') {
      initHandTracking();
    } else if (prev === 'hand') {
      stopHandTracking();
    }
  }, [initHandTracking, stopHandTracking]);

  // ── Voice helpers ────────────────────────────────────────────────────────
  const setUiStateSafe = useCallback((nextState) => {
    uiStateRef.current = nextState;
    setUiState(nextState);
  }, []);

  const appendMessage = useCallback((role, text) => {
    const trimmed = text?.trim();
    if (!trimmed) return '';
    const id = buildId(role);
    setMessages((prev) => [...prev, { id, role, text: trimmed, time: formatTime() }]);
    return id;
  }, []);

  const appendAiChunk = useCallback((chunk) => {
    if (!chunk) return;
    setMessages((prev) => {
      const next = [...prev];
      if (aiDraftIdRef.current) {
        const idx = next.findIndex((item) => item.id === aiDraftIdRef.current);
        if (idx >= 0) {
          next[idx] = { ...next[idx], text: `${next[idx].text}${chunk}` };
          return next;
        }
      }
      const id = buildId('ai');
      aiDraftIdRef.current = id;
      next.push({ id, role: 'ai', text: chunk, time: formatTime() });
      return next;
    });
  }, []);

  const clearResumeTimers = useCallback(() => {
    if (resumeListeningTimerRef.current) { clearTimeout(resumeListeningTimerRef.current); resumeListeningTimerRef.current = null; }
    if (responseIdleTimerRef.current)    { clearTimeout(responseIdleTimerRef.current);    responseIdleTimerRef.current    = null; }
  }, []);

  const stopRecognition = useCallback(() => {
    const r = recognitionRef.current;
    recognitionRef.current = null;
    recognitionFinalRef.current = '';
    if (!r) return;
    try { r.onresult = null; r.onerror = null; r.onend = null; r.stop(); } catch { /**/ }
  }, []);

  const stopMicCapture = useCallback((resetLevel = true) => {
    processorRef.current?.disconnect(); processorRef.current = null;
    micSourceRef.current?.disconnect(); micSourceRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop()); micStreamRef.current = null;
    if (resetLevel) setVoiceLevel(0);
  }, []);

  const stopPlayback = useCallback((resetLevel = true) => {
    outputSourcesRef.current.forEach((src) => { try { src.stop(0); } catch { /**/ } });
    outputSourcesRef.current.clear();
    scheduleRef.current = 0;
    if (resetLevel) setVoiceLevel(0);
  }, []);

  const getPlayCtx = useCallback(async () => {
    if (!playCtxRef.current || playCtxRef.current.state === 'closed') {
      playCtxRef.current = new AudioContext({ sampleRate: 24000 });
      scheduleRef.current = 0;
    }
    if (playCtxRef.current.state === 'suspended') await playCtxRef.current.resume();
    return playCtxRef.current;
  }, []);

  const requestTextReply = useCallback(async (transcript, turnToken) => {
    if (!apiKey.trim()) return;
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-001', 'gemini-1.5-flash'];
    try {
      let lastError = '';
      for (const modelName of models) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey.trim()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: 'Reply only in Tanglish (Tamil + English mix) using Roman letters only. Do not use Tamil script. Keep it short and natural.\n\nUser: ' + transcript }] }],
            }),
          }
        );
        if (res.status === 404) continue;
        if (!res.ok) { lastError = `Text reply request failed (${res.status})`; break; }
        const payload = await res.json();
        const text = (payload?.candidates?.[0]?.content?.parts || [])
          .map((p) => (typeof p.text === 'string' ? p.text : '')).join('').trim();
        if (!text) continue;
        if (turnToken !== textTurnRef.current) return;
        if (stopRequestedRef.current || !sessionActiveRef.current) return;
        if (uiStateRef.current === UI_STATES.PROCESSING) setUiStateSafe(UI_STATES.RESPONDING);
        setIsTyping(false);
        appendAiChunk(text);
        aiDraftIdRef.current = '';
        return;
      }
      if (lastError) throw new Error(lastError);
    } catch (err) {
      if (turnToken !== textTurnRef.current) return;
      if (stopRequestedRef.current || !sessionActiveRef.current) return;
      appendMessage('system', `Text reply error: ${err.message}`);
    }
  }, [apiKey, appendAiChunk, appendMessage, setUiStateSafe]);

  const handleFinalTranscript = useCallback((rawText) => {
    if (stopRequestedRef.current || !sessionActiveRef.current) return;
    const transcript = rawText.trim();
    setInterimTranscript('');
    stopMicCapture();
    if (!transcript) {
      if (!stopRequestedRef.current && sessionActiveRef.current) {
        resumeListeningTimerRef.current = setTimeout(() => startListeningCycleRef.current?.(), 260);
      }
      return;
    }
    appendMessage('user', transcript);
    aiDraftIdRef.current = '';
    setIsTyping(true);
    setVoiceLevel(0);
    setUiStateSafe(UI_STATES.PROCESSING);
    textTurnRef.current += 1;
    void requestTextReply(transcript, textTurnRef.current);
  }, [appendMessage, requestTextReply, setUiStateSafe, stopMicCapture]);

  const startSpeechRecognition = useCallback(() => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) { appendMessage('system', 'Speech recognition not available.'); return false; }
    stopRecognition();
    const r = new Ctor();
    r.lang = 'en-US'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    recognitionFinalRef.current = '';
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const t = res[0]?.transcript ?? '';
        if (res.isFinal) recognitionFinalRef.current += `${t} `;
        else interim += t;
      }
      setInterimTranscript(interim.trim());
    };
    r.onerror = (e) => {
      if (stopRequestedRef.current) return;
      if (e.error === 'aborted' || e.error === 'no-speech') return;
      appendMessage('system', `Speech error: ${e.error}`);
    };
    r.onend = () => {
      if (recognitionRef.current !== r) return;
      recognitionRef.current = null;
      handleFinalTranscript(recognitionFinalRef.current);
      recognitionFinalRef.current = '';
    };
    try { r.start(); recognitionRef.current = r; return true; }
    catch (err) { appendMessage('system', `Recognition start failed: ${err.message}`); return false; }
  }, [appendMessage, handleFinalTranscript, stopRecognition]);

  const startMicCapture = useCallback(async () => {
    if (processorRef.current) return true;
    try {
      if (!recCtxRef.current || recCtxRef.current.state === 'closed') recCtxRef.current = new AudioContext({ sampleRate: 16000 });
      if (recCtxRef.current.state === 'suspended') await recCtxRef.current.resume();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      const source = recCtxRef.current.createMediaStreamSource(stream);
      const processor = recCtxRef.current.createScriptProcessor(4096, 1, 1);
      micSourceRef.current = source; processorRef.current = processor;
      processor.onaudioprocess = (e) => {
        if (stopRequestedRef.current) return;
        const samples = e.inputBuffer.getChannelData(0);
        setVoiceLevel((prev) => prev * 0.55 + Math.min(1, computeRms(samples) * 10) * 0.45);
        if (liveApiRef.current) liveApiRef.current.sendAudio(float32ToBase64Pcm16(samples));
      };
      source.connect(processor); processor.connect(recCtxRef.current.destination);
      return true;
    } catch (err) {
      setErrorMsg(err.message);
      appendMessage('system', `Microphone error: ${err.message}`);
      return false;
    }
  }, [appendMessage]);

  const startListeningCycle = useCallback(async () => {
    if (stopRequestedRef.current || !sessionActiveRef.current) return false;
    clearResumeTimers();
    setErrorMsg(''); setIsTyping(false); setInterimTranscript('');
    setUiStateSafe(UI_STATES.LISTENING);
    const micReady = await startMicCapture();
    if (!micReady) return false;
    const recReady = startSpeechRecognition();
    if (!recReady) { stopMicCapture(); return false; }
    return true;
  }, [clearResumeTimers, setUiStateSafe, startMicCapture, startSpeechRecognition, stopMicCapture]);

  useEffect(() => { startListeningCycleRef.current = startListeningCycle; }, [startListeningCycle]);

  const scheduleResumeListening = useCallback(() => {
    clearResumeTimers();
    const ctx = playCtxRef.current;
    const remaining = ctx ? Math.max(0, scheduleRef.current - ctx.currentTime) : 0;
    resumeListeningTimerRef.current = setTimeout(() => {
      if (!sessionActiveRef.current || stopRequestedRef.current) return;
      if (!CONTINUOUS_MODE) { setPanelOpen(false); setUiStateSafe(UI_STATES.IDLE); sessionActiveRef.current = false; return; }
      startListeningCycleRef.current?.();
    }, remaining * 1000 + 140);
  }, [clearResumeTimers, setUiStateSafe]);

  const bumpResponseIdleTimer = useCallback(() => {
    if (responseIdleTimerRef.current) clearTimeout(responseIdleTimerRef.current);
    responseIdleTimerRef.current = setTimeout(() => {
      if (!stopRequestedRef.current && sessionActiveRef.current) scheduleResumeListening();
    }, 1800);
  }, [scheduleResumeListening]);

  const handleIncomingAudio = useCallback(async (base64) => {
    if (stopRequestedRef.current) return;
    try {
      const ctx = await getPlayCtx();
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;
      setVoiceLevel((prev) => prev * 0.5 + Math.min(1, computeRms(float32) * 14) * 0.5);
      if (uiStateRef.current !== UI_STATES.RESPONDING) setUiStateSafe(UI_STATES.RESPONDING);
      setIsTyping(false);
      const buf = ctx.createBuffer(1, float32.length, 24000);
      buf.getChannelData(0).set(float32);
      const src = ctx.createBufferSource();
      src.buffer = buf; src.connect(ctx.destination);
      const startAt = Math.max(ctx.currentTime + 0.04, scheduleRef.current);
      scheduleRef.current = startAt + buf.duration;
      src.start(startAt);
      outputSourcesRef.current.add(src);
      src.onended = () => outputSourcesRef.current.delete(src);
      bumpResponseIdleTimer();
    } catch (err) { appendMessage('system', `Playback error: ${err.message}`); }
  }, [appendMessage, bumpResponseIdleTimer, getPlayCtx, setUiStateSafe]);

  const handleToolCalls = useCallback(async (calls) => {
    if (!calls?.length || !liveApiRef.current) return;
    const responses = [];
    for (const call of calls) {
      const handler = toolHandlers[call.name];
      if (!handler) continue;
      try { responses.push({ id: call.id, name: call.name, response: { result: await handler(call.args || call.arguments || {}) } }); }
      catch (err) { responses.push({ id: call.id, name: call.name, response: { error: err.message } }); }
    }
    if (responses.length) liveApiRef.current.sendToolResponse(responses);
  }, []);

  const ensureConnected = useCallback(async () => {
    if (liveApiRef.current && connectionStatus === 'connected') return true;
    if (!apiKey.trim()) {
      setErrorMsg('Add your Google AI Studio API key first.');
      appendMessage('system', 'Please add your API key before starting a session.');
      return false;
    }
    return new Promise((resolve) => {
      const api = new LiveAPI(apiKey.trim());
      liveApiRef.current = api;
      let settled = false, seenConnected = false;
      const settle = (ok) => {
        if (settled) return; settled = true;
        if (!ok) { api.disconnect(); if (liveApiRef.current === api) liveApiRef.current = null; setConnectionStatus('disconnected'); }
        resolve(ok);
      };
      api.onStatusChange = (status) => {
        setConnectionStatus(status);
        if (status === 'connected') { seenConnected = true; settle(true); }
        if (status === 'disconnected' && !seenConnected) settle(false);
      };
      api.onError = (msg) => { setErrorMsg(msg); appendMessage('system', msg); settle(false); };
      api.onAudioData = handleIncomingAudio;
      api.onTextData = (text) => {
        if (stopRequestedRef.current) return;
        if (uiStateRef.current !== UI_STATES.RESPONDING) setUiStateSafe(UI_STATES.RESPONDING);
        setIsTyping(false); appendAiChunk(text); bumpResponseIdleTimer();
      };
      api.onTurnComplete = () => {
        if (stopRequestedRef.current || !sessionActiveRef.current) return;
        aiDraftIdRef.current = ''; setIsTyping(false); scheduleResumeListening();
      };
      api.onToolCall = handleToolCalls;
      api.connect({ tools });
      setTimeout(() => {
        if (!settled) { setErrorMsg('Connection timeout.'); appendMessage('system', 'Connection timeout.'); settle(false); }
      }, 15000);
    });
  }, [apiKey, appendAiChunk, appendMessage, bumpResponseIdleTimer, connectionStatus, handleIncomingAudio, handleToolCalls, scheduleResumeListening, setUiStateSafe]);

  const stopAll = useCallback(() => {
    stopRequestedRef.current = true; transitionLockRef.current = false; sessionActiveRef.current = false;
    textTurnRef.current += 1;
    clearResumeTimers(); stopRecognition(); stopMicCapture(); stopPlayback();
    liveApiRef.current?.disconnect(); liveApiRef.current = null;
    setConnectionStatus('disconnected'); setErrorMsg(''); setIsTyping(false);
    setInterimTranscript(''); aiDraftIdRef.current = '';
    setPanelOpen(false); setUiStateSafe(UI_STATES.IDLE);
  }, [clearResumeTimers, setUiStateSafe, stopMicCapture, stopPlayback, stopRecognition]);

  const startConversation = useCallback(async () => {
    if (transitionLockRef.current || sessionActiveRef.current) return;
    transitionLockRef.current = true;
    stopRequestedRef.current = false; sessionActiveRef.current = true;
    setPanelOpen(true); setSettingsOpen(false); setErrorMsg('');
    if (!supportsRecognition) {
      appendMessage('system', 'Speech recognition required.');
      setPanelOpen(false); setUiStateSafe(UI_STATES.IDLE); sessionActiveRef.current = false; transitionLockRef.current = false; return;
    }
    const connected = await ensureConnected();
    if (!connected) {
      setPanelOpen(false); setUiStateSafe(UI_STATES.IDLE); sessionActiveRef.current = false; transitionLockRef.current = false; return;
    }
    const started = await startListeningCycleRef.current?.();
    if (!started) stopAll();
    transitionLockRef.current = false;
  }, [appendMessage, ensureConnected, setUiStateSafe, stopAll, supportsRecognition]);

  // ── Side effects ─────────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('forge_api_key', apiKey); }, [apiKey]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [interimTranscript, isTyping, messages, panelOpen]);

  useEffect(() => {
    const timer = setInterval(() => {
      setVoiceLevel((prev) => {
        const decay = uiStateRef.current === UI_STATES.IDLE ? 0.65 : 0.86;
        const next = prev * decay;
        return next < 0.02 ? 0 : next;
      });
    }, 80);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => () => {
    stopRequestedRef.current = true;
    clearResumeTimers(); stopRecognition(); stopMicCapture(false); stopPlayback(false);
    liveApiRef.current?.disconnect(); recCtxRef.current?.close(); playCtxRef.current?.close();
  }, [clearResumeTimers, stopMicCapture, stopPlayback, stopRecognition]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const pulseStrength =
    uiState === UI_STATES.LISTENING  ? Math.max(0.18, Math.min(1, voiceLevel * 1.15 + 0.06)) :
    uiState === UI_STATES.RESPONDING ? Math.max(0.25, Math.min(1, voiceLevel * 1.4  + 0.08)) : 0;

  const appClass = `app-shell state-${uiState.toLowerCase()}${panelOpen ? ' panel-open' : ''}`;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={appClass} style={{ '--pulse-strength': pulseStrength }}>

      {/* ── Main voice stage ── */}
      <main className="voice-center">

        {/* Logo + pulse rings — logo-zone receives JS translate+tilt */}
        <div
          ref={logoZoneRef}
          className={`logo-zone${uiState !== UI_STATES.IDLE ? ' logo-zone--active' : ''}`}
        >
          <div className="pulse-glow" aria-hidden="true" />
          <div className="pulse-rings" aria-hidden="true">
            <div className="pulse-ring pulse-ring--1" />
            <div className="pulse-ring pulse-ring--2" />
            <div className="pulse-ring pulse-ring--3" />
          </div>
          <div className="logo-frame">
            <ForgeLogo eyeLRef={eyeLRef} eyeRRef={eyeRRef} svgRef={logoSvgRef} />
          </div>
        </div>

        {/* State copy */}
        <div className="state-copy">
          <p className="state-copy__title">{getStateTitle(uiState)}</p>
          <p className="state-copy__subtitle">{getStateSubtitle(uiState)}</p>
        </div>

        {/* Live interim transcript */}
        {uiState === UI_STATES.LISTENING && interimTranscript && (
          <div className="interim-bubble">{interimTranscript}</div>
        )}

        {/* Thinking indicator */}
        {uiState === UI_STATES.PROCESSING && isTyping && (
          <div className="typing-indicator">
            <span /><span /><span />
            <p>Forge is thinking...</p>
          </div>
        )}

        {/* Primary CTA */}
        <div className="action-strip">
          {!panelOpen ? (
            <button className="talk-btn" onClick={startConversation}>
              <Mic size={20} />
              Talk to Forge AI
            </button>
          ) : (
            <button className="stop-btn" onClick={stopAll}>
              <MicOff size={20} />
              Stop
            </button>
          )}
        </div>

        {/* Logo animation mode buttons */}
        {!panelOpen && (
          <div className="mode-bar">
            {LOGO_MODES.map(({ key, label }) => (
              <button
                key={key}
                className={`mode-btn${logoMode === key ? ' mode-btn--active' : ''}`}
                onClick={() => switchLogoMode(key)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="error-chip">
            <AlertCircle size={14} />
            <span>{errorMsg}</span>
          </div>
        )}
      </main>

      {/* ── Bottom bar ── */}
      <div className="bottom-bar">
        <button
          className={`settings-toggle${settingsOpen ? ' settings-toggle--open' : ''}`}
          onClick={() => setSettingsOpen((v) => !v)}
          disabled={panelOpen}
          title="Configure API Key"
        >
          <Settings size={14} />
          <span>API KEY</span>
        </button>
        <span className="bottom-sep" />
        <p className="connection-chip">
          <span className={`conn-dot conn-dot--${connectionStatus}`} />
          {connectionStatus}
        </p>
      </div>

      {/* ── Settings popup ── */}
      {settingsOpen && !panelOpen && (
        <div className="settings-popup">
          <label htmlFor="api-key">
            <Settings size={13} />
            Google AI Studio API Key
          </label>
          <input
            id="api-key"
            type="password"
            placeholder="Paste your key here..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoFocus
          />
        </div>
      )}

      {/* ── Chat panel (right overlay) ── */}
      <aside className={`chat-panel${panelOpen ? ' chat-panel--open' : ''}`}>
        <header className="chat-header">
          <div className="chat-header__title">
            <MessageSquareText size={16} />
            <span>Conversation</span>
          </div>
          <span className={`state-pill state-pill--${uiState.toLowerCase()}`}>{uiState}</span>
        </header>

        <div className="chat-stream">
          {messages.length === 0 && (
            <div className="chat-empty">
              <p>Start speaking. Messages will appear here in real time.</p>
            </div>
          )}
          {messages.map((msg) => (
            <article key={msg.id} className={`msg msg--${msg.role}`}>
              <div className="msg__meta">
                <span>{msg.role === 'ai' ? 'Forge AI' : msg.role === 'user' ? 'You' : 'System'}</span>
                <time>{msg.time}</time>
              </div>
              <p>{msg.text}</p>
            </article>
          ))}
          {uiState === UI_STATES.LISTENING && interimTranscript && (
            <article className="msg msg--draft">
              <div className="msg__meta"><span>Listening</span><time>{formatTime()}</time></div>
              <p>{interimTranscript}</p>
            </article>
          )}
          {uiState === UI_STATES.PROCESSING && isTyping && (
            <div className="typing-indicator">
              <span /><span /><span />
              <p>Forge is thinking...</p>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>
      </aside>
    </div>
  );
}
