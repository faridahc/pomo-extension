const MODES = {
  focus: { label: "Focus", duration: 25 * 60 },
  short: { label: "Short Break", duration: 5 * 60 },
  long:  { label: "Long Break",  duration: 15 * 60 },
};

let state = {
  mode: "focus",
  timeLeft: 25 * 60,
  isRunning: false,
  session: 1,
  startedAt: null,
};

chrome.storage.local.get("pomodoroState", (data) => {
  if (data.pomodoroState) {
    state = { ...state, ...data.pomodoroState };
    if (state.isRunning && state.startedAt) {
      const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
      state.timeLeft = Math.max(0, state.timeLeft - elapsed);
      if (state.timeLeft === 0) timerComplete();
    }
  }
});

function saveState() {
  chrome.storage.local.set({ pomodoroState: state });
}

function timerComplete() {
  const wasMode = state.mode;
  state.isRunning = false;
  state.startedAt = null;

  if (wasMode === "focus") {
    state.mode = state.session % 4 === 0 ? "long" : "short";
  } else {
    if (wasMode !== "focus") state.session += 1;
    state.mode = "focus";
  }

  state.timeLeft = MODES[state.mode].duration;
  saveState();

  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: wasMode === "focus" ? "🎉 Focus session done!" : "⏱ Break over!",
    message: wasMode === "focus" ? "Time for a break." : "Back to focus!",
    priority: 2,
  });
}

chrome.alarms.create("tick", { periodInMinutes: 1 / 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== "tick" || !state.isRunning) return;
  const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
  state.timeLeft = MODES[state.mode].duration - elapsed;
  if (state.timeLeft <= 0) { state.timeLeft = 0; timerComplete(); }
  else saveState();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.action) {
    case "GET_STATE":
      sendResponse({ ...state });
      break;
    case "START":
      state.isRunning = true;
      state.startedAt = Date.now() - (MODES[state.mode].duration - state.timeLeft) * 1000;
      saveState();
      sendResponse({ ...state });
      break;
    case "PAUSE":
      state.isRunning = false;
      state.startedAt = null;
      saveState();
      sendResponse({ ...state });
      break;
    case "RESET":
      state.isRunning = false;
      state.startedAt = null;
      state.timeLeft = MODES[state.mode].duration;
      saveState();
      sendResponse({ ...state });
      break;
    case "SET_MODE":
      state.isRunning = false;
      state.startedAt = null;
      state.mode = msg.mode;
      state.timeLeft = MODES[msg.mode].duration;
      saveState();
      sendResponse({ ...state });
      break;
  }
  return true;
});
