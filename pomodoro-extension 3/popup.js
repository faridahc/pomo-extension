const MODES = {
  focus: { label: "Focus",       duration: 25 * 60, color: "" },
  short: { label: "Short Break", duration:  5 * 60, color: "green" },
  long:  { label: "Long Break",  duration: 15 * 60, color: "blue" },
};

const CIRCUMFERENCE = 2 * Math.PI * 78; // ~490

let state = { mode: "focus", timeLeft: 25 * 60, isRunning: false, session: 1 };
let ticker = null;

const display     = document.getElementById("timerDisplay");
const modeLabel   = document.getElementById("modeLabel");
const ring        = document.getElementById("ringProgress");
const btnPlay     = document.getElementById("btnPlay");
const sessionBadge = document.getElementById("sessionBadge");
const dots        = document.getElementById("sessionDots");

function fmt(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function applyColor(color) {
  const c = color || "";
  ring.className       = "ring-progress " + c;
  btnPlay.className    = "btn-primary " + c;
  document.querySelectorAll(".mode-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.mode === state.mode);
  });
  document.body.className = "mode-" + state.mode;
}

function render() {
  const cfg = MODES[state.mode];
  display.textContent = fmt(state.timeLeft);
  modeLabel.textContent = cfg.label;
  btnPlay.textContent = state.isRunning ? "⏸" : "▶";
  applyColor(cfg.color);
  sessionBadge.textContent = `session ${state.session}`;

  // Ring
  const pct = state.timeLeft / cfg.duration;
  ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct);

  // Dots — highlight completed sessions
  const dotEls = dots.querySelectorAll(".dot");
  dotEls.forEach((d, i) => {
    d.classList.toggle("done", i < ((state.session - 1) % 4));
  });
}

function send(action, extra = {}) {
  return new Promise(res =>
    chrome.runtime.sendMessage({ action, ...extra }, s => res(s))
  );
}

async function sync() {
  const s = await send("GET_STATE");
  if (s) { state = s; render(); }
}

async function togglePlay() {
  const s = await send(state.isRunning ? "PAUSE" : "START");
  if (s) { state = s; render(); }
  if (!state.isRunning) { clearInterval(ticker); ticker = null; }
  else startTicker();
}

function startTicker() {
  if (ticker) return;
  ticker = setInterval(async () => {
    const s = await send("GET_STATE");
    if (s) { state = s; render(); }
    if (!state.isRunning) { clearInterval(ticker); ticker = null; }
  }, 1000);
}

document.getElementById("btnPlay").onclick = togglePlay;

document.getElementById("btnReset").onclick = async () => {
  clearInterval(ticker); ticker = null;
  const s = await send("RESET");
  if (s) { state = s; render(); }
};

document.getElementById("btnSkip").onclick = async () => {
  clearInterval(ticker); ticker = null;
  const next = state.mode === "focus"
    ? (state.session % 4 === 0 ? "long" : "short")
    : "focus";
  const s = await send("SET_MODE", { mode: next });
  if (s) { state = s; render(); }
};

document.querySelectorAll(".mode-tab").forEach(tab => {
  tab.onclick = async () => {
    clearInterval(ticker); ticker = null;
    const s = await send("SET_MODE", { mode: tab.dataset.mode });
    if (s) { state = s; render(); }
  };
});

// Init
sync().then(() => { if (state.isRunning) startTicker(); });
