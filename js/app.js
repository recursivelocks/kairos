// Kairos GPS - Entrypoint Coordinator Module
import {
  state,
  saveStateToLocalStorage,
  loadStateFromLocalStorage,
  milestoneManager,
  setOnStateSave,
  stopTimer
} from './state.js';

import { showToast } from './utils.js';

import {
  isFirebaseActive,
  currentUser,
  initializeFirebase,
  signInWithGoogle,
  signOutFirebase,
  syncStateToCloud
} from './firebase-sync.js';

import {
  generateDailyRoute,
  resetCurrentRoute,
  completeActiveSlot,
  saveSlotEdit,
  applyRecalculation
} from './scheduler.js';

import {
  renderTimeline,
  setupActiveFocusBlock,
  renderCompass,
  renderHistory,
  updateViewVisibility,
  switchTab,
  syncActiveSlotWithLocalTime,
  updateTimerDisplay,
  closeEditSlotModal,
  renderBacklog
} from './ui-render.js';

const STRATEGIES = {
  pomodoro: { name: 'Pomodoro (25/5)', focusMins: 25, breakMins: 5 },
  timebox: { name: 'Time-Boxing (50/10)', focusMins: 50, breakMins: 10 },
  frog: { name: 'Eat the Frog (Deep Work)', focusMins: 90, breakMins: 15 },
  micro: { name: '10-Min Microtasks', focusMins: 10, breakMins: 2 },
  rest: { name: 'Mindful Recharge', focusMins: 15, breakMins: 0 },
  routine: { name: 'Mindful Start/End', focusMins: 30, breakMins: 0 }
};

let deferredPrompt = null;

// Bind cloud state backups asynchronously to storage saves to keep graph clean
setOnStateSave(() => {
  if (isFirebaseActive && currentUser) {
    syncStateToCloud();
  }
});

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  milestoneManager.setCallbacks({
    onStateChange: () => {
      saveStateToLocalStorage();
      renderBacklog();
      renderCompass();
      if (state.currentRoute) {
        renderTimeline();
        setupActiveFocusBlock();
      }
    },
    showNotification: (msg) => {
      showToast(msg);
    }
  });

  loadStateFromLocalStorage();
  initializeTheme();
  initializeFirebase();
  setupEventListeners();

  renderBacklog();
  renderHistory();
  renderCompass();
  updateViewVisibility();
  
  if (state.currentRoute) {
    syncActiveSlotWithLocalTime();
    renderTimeline();
    setupActiveFocusBlock();
    
    // Periodically sync active slot with the clock
    setInterval(syncActiveSlotWithLocalTime, 20000); 
  }
});

// --- THEME MANAGEMENT ---
function initializeTheme() {
  const allowedThemes = ['dark', 'cream', 'oled'];
  if (!allowedThemes.includes(state.theme)) {
    state.theme = 'cream';
  }

  // One-time theme migration to default existing users to cream light theme
  const themeMigrated = localStorage.getItem('kairos_theme_migrated_v35');
  if (!themeMigrated) {
    state.theme = 'cream';
    localStorage.setItem('kairos_theme_migrated_v35', 'true');
    saveStateToLocalStorage();
  }

  document.documentElement.setAttribute('data-theme', state.theme);
  const activeBtn = document.querySelector(`.theme-btn[data-theme="${state.theme}"]`);
  if (activeBtn) {
    document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
    activeBtn.classList.add('active');
  }
}

function setTheme(themeName) {
  state.theme = themeName;
  document.documentElement.setAttribute('data-theme', themeName);
  saveStateToLocalStorage();
}

// --- EVENT BINDINGS ---
function setupEventListeners() {
  // Theme selectors
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      setTheme(e.target.dataset.theme);
    });
  });

  // Tab switcher
  document.querySelectorAll('.tab-bar .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.view);
    });
  });

  // Onboarding Inputs - Link to pillars
  const pillarInputs = [1, 2, 3];
  pillarInputs.forEach(num => {
    const input = document.getElementById(`pillar-${num}`);
    if (input) {
      input.addEventListener('change', (e) => {
        state.pillars[num] = e.target.value.trim() || `Pillar ${num}`;
        saveStateToLocalStorage();
        const option = document.querySelector(`#task-pillar-select option[value="${num}"]`);
        if (option) option.textContent = state.pillars[num];
      });
    }
  });

  // Add Backlog Task
  const btnAddTask = document.getElementById('btn-add-task');
  const taskInput = document.getElementById('task-input');
  const taskPillarSelect = document.getElementById('task-pillar-select');
  
  if (btnAddTask && taskInput) {
    const handleAddTask = () => {
      const text = taskInput.value.trim();
      if (!text) return;
      const pillarId = taskPillarSelect ? taskPillarSelect.value : '1';
      
      milestoneManager.addTask(text, pillarId);
      taskInput.value = '';
    };

    btnAddTask.addEventListener('click', handleAddTask);
    taskInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleAddTask();
    });
  }

  // Generate route button
  const btnGenRoute = document.getElementById('btn-generate-route');
  if (btnGenRoute) {
    btnGenRoute.addEventListener('click', () => {
      generateDailyRoute();
      syncActiveSlotWithLocalTime();
    });
  }

  // Reset timeline button
  const btnResetTime = document.getElementById('btn-reset-timeline');
  if (btnResetTime) {
    btnResetTime.addEventListener('click', () => {
      if (confirm("Are you sure you want to reset today's route and plan again?")) {
        resetCurrentRoute();
      }
    });
  }

  // Timer controls
  const btnToggleTimer = document.getElementById('btn-toggle-timer');
  if (btnToggleTimer) {
    btnToggleTimer.addEventListener('click', () => {
      toggleTimer();
    });
  }

  const btnSkipTimer = document.getElementById('btn-skip-timer');
  if (btnSkipTimer) {
    btnSkipTimer.addEventListener('click', () => {
      skipTimer();
    });
  }

  const btnCompleteTask = document.getElementById('btn-complete-task');
  if (btnCompleteTask) {
    btnCompleteTask.addEventListener('click', () => {
      completeActiveSlot();
    });
  }

  // Recalculation overlay controls
  const btnRecalculate = document.getElementById('btn-recalculate');
  if (btnRecalculate) {
    btnRecalculate.addEventListener('click', () => {
      openRecalculateOverlay();
    });
  }

  const btnCloseRecalc = document.getElementById('btn-close-recalculate');
  if (btnCloseRecalc) {
    btnCloseRecalc.addEventListener('click', () => {
      closeRecalculateOverlay();
    });
  }

  const btnApplyRecalc = document.getElementById('btn-apply-recalculation');
  if (btnApplyRecalc) {
    btnApplyRecalc.addEventListener('click', () => {
      applyRecalculation();
    });
  }

  document.querySelectorAll('.recalculate-card').forEach(card => {
    card.addEventListener('click', (e) => {
      document.querySelectorAll('.recalculate-card').forEach(c => c.classList.remove('selected'));
      const targetCard = e.target.closest('.recalculate-card');
      if (targetCard) targetCard.classList.add('selected');
    });
  });

  // Reflection Submit
  const btnSubmitDay = document.getElementById('btn-submit-day');
  if (btnSubmitDay) {
    btnSubmitDay.addEventListener('click', () => {
      submitDayReflection();
    });
  }

  // Compass motto & description event listeners
  const mottoInput = document.getElementById('compass-motto-input');
  if (mottoInput) {
    mottoInput.addEventListener('change', (e) => {
      state.compass.motto = e.target.value.trim() || 'Focus on what you can control.';
      saveStateToLocalStorage();
    });
  }

  for (let i = 1; i <= 3; i++) {
    const descInput = document.getElementById(`compass-desc-${i}`);
    if (descInput) {
      descInput.addEventListener('change', (e) => {
        state.compass.pillarDescriptions[i] = e.target.value.trim();
        saveStateToLocalStorage();
      });
    }
  }

  // Add Compass Reminder
  const btnAddReminder = document.getElementById('btn-add-reminder');
  const reminderInput = document.getElementById('reminder-input');

  if (btnAddReminder && reminderInput) {
    const handleAddReminder = () => {
      const text = reminderInput.value.trim();
      if (!text) return;
      state.compass.reminders.push(text);
      reminderInput.value = '';
      saveStateToLocalStorage();
      renderCompass();
    };

    btnAddReminder.addEventListener('click', handleAddReminder);
    reminderInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleAddReminder();
    });
  }

  // Add Backlog Task from Compass Page
  const btnCompassAddTask = document.getElementById('btn-compass-add-task');
  const compassTaskInput = document.getElementById('compass-task-input');
  const compassPillarSelect = document.getElementById('compass-task-pillar-select');

  if (btnCompassAddTask && compassTaskInput) {
    const handleCompassAddTask = () => {
      const text = compassTaskInput.value.trim();
      if (!text) return;
      const pillarId = compassPillarSelect ? compassPillarSelect.value : '1';

      milestoneManager.addTask(text, pillarId);
      compassTaskInput.value = '';
    };

    btnCompassAddTask.addEventListener('click', handleCompassAddTask);
    compassTaskInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleCompassAddTask();
    });
  }

  // Edit slot modal controls
  const btnCloseEditSlot = document.getElementById('btn-close-edit-slot');
  if (btnCloseEditSlot) {
    btnCloseEditSlot.addEventListener('click', closeEditSlotModal);
  }

  const btnSaveSlotEdit = document.getElementById('btn-save-slot-edit');
  if (btnSaveSlotEdit) {
    btnSaveSlotEdit.addEventListener('click', () => {
      saveSlotEdit();
    });
  }

  const editSlotBacklogSelect = document.getElementById('edit-slot-backlog-select');
  if (editSlotBacklogSelect) {
    editSlotBacklogSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        document.getElementById('edit-slot-title').value = e.target.value;
      }
    });
  }

  // Firebase Google Auth Sign-in & Sign-out listeners
  const btnGoogleSignin = document.getElementById('btn-google-signin');
  if (btnGoogleSignin) {
    btnGoogleSignin.addEventListener('click', async () => {
      if (!isFirebaseActive) {
        showToast("Firebase sync is currently offline.");
        return;
      }
      try {
        await signInWithGoogle();
      } catch (err) {
        console.error("Google sign-in error:", err);
        showToast("Sign in failed: " + err.message);
      }
    });
  }

  const btnFbSignout = document.getElementById('btn-fb-signout');
  if (btnFbSignout) {
    btnFbSignout.addEventListener('click', async () => {
      try {
        await signOutFirebase();
        showToast("Disconnected Cloud Sync. Reverted to local-only mode.");
      } catch (err) {
        showToast("Sign out failed: " + err.message);
      }
    });
  }

  // PWA Manual Installation trigger
  const btnInstall = document.getElementById('btn-install-pwa');
  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`PWA Installation outcome: ${outcome}`);
        deferredPrompt = null;
        document.getElementById('pwa-install-container').style.display = 'none';
      }
    });
  }
}

// --- FOCUS BLOCK TIMER CONTROLS ---
function toggleTimer() {
  const wrapper = document.getElementById('timer-wrapper');
  const btn = document.getElementById('btn-toggle-timer');
  if (!wrapper || !btn) return;

  if (state.timer.isRunning) {
    stopTimer();
    btn.innerHTML = `<svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    btn.classList.add('active');
    wrapper.classList.remove('ticking');
  } else {
    state.timer.isRunning = true;
    btn.innerHTML = `<svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    btn.classList.remove('active');
    wrapper.classList.add('ticking');

    state.timer.intervalId = setInterval(() => {
      state.timer.remaining--;
      if (state.timer.remaining <= 0) {
        handleTimerExpiry();
      }
      updateTimerDisplay();
      saveStateToLocalStorage();
    }, 1000);
  }
  saveStateToLocalStorage();
}

function handleTimerExpiry() {
  stopTimer();
  playBeepAlert();

  const slot = state.currentRoute.slots[state.activeSlotIndex];
  const strat = STRATEGIES[slot.strategy];

  if (state.timer.type === 'focus' && strat && strat.breakMins > 0) {
    state.timer.type = 'break';
    state.timer.duration = strat.breakMins * 60;
    state.timer.remaining = state.timer.duration;
    showToast("Rest block initialized!");
    toggleTimer();
  } else {
    showToast("Interval finished! Ready for next block.");
    state.timer.type = 'focus';
    const durationMins = strat ? strat.focusMins : slot.duration;
    state.timer.duration = durationMins * 60;
    state.timer.remaining = state.timer.duration;
    updateTimerDisplay();
  }
  saveStateToLocalStorage();
}

function skipTimer() {
  stopTimer();
  const slot = state.currentRoute.slots[state.activeSlotIndex];
  const strat = STRATEGIES[slot.strategy];
  
  if (state.timer.type === 'focus') {
    if (strat && strat.breakMins > 0) {
      state.timer.type = 'break';
      state.timer.duration = strat.breakMins * 60;
      state.timer.remaining = state.timer.duration;
      updateTimerDisplay();
    } else {
      completeActiveSlot();
    }
  } else {
    state.timer.type = 'focus';
    const durationMins = strat ? strat.focusMins : slot.duration;
    state.timer.duration = durationMins * 60;
    state.timer.remaining = state.timer.duration;
    updateTimerDisplay();
  }
  saveStateToLocalStorage();
}

function playBeepAlert() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5 note
    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.8);
  } catch (e) {
    console.log("AudioContext blocked or unsupported.");
  }
}

// --- GPS RECALCULATE ROUTE ENGINE ---
function openRecalculateOverlay() {
  const overlay = document.getElementById('recalculate-overlay');
  if (overlay) overlay.classList.add('active');
  document.querySelectorAll('.recalculate-card').forEach(c => c.classList.remove('selected'));
}

function closeRecalculateOverlay() {
  const overlay = document.getElementById('recalculate-overlay');
  if (overlay) overlay.classList.remove('active');
}

// --- DAY ARCHIVE REFLECTION ---
function submitDayReflection() {
  const note = document.getElementById('reflection-input').value.trim();
  
  const completedCount = state.currentRoute.slots.filter(s => s.completed).length;
  const totalCount = state.currentRoute.slots.length;
  const accuracy = Math.round((completedCount / totalCount) * 100);

  const pillarsUsed = new Set();
  state.currentRoute.slots.forEach(s => {
    if (s.completed && s.pillar) pillarsUsed.add(s.pillar);
  });

  const today = new Date();
  const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  const dateStr = today.toLocaleDateString('en-US', dateOptions);

  const entry = {
    date: dateStr,
    accuracy: accuracy,
    tasksCompleted: completedCount,
    tasksTotal: totalCount,
    pillarsUsed: Array.from(pillarsUsed),
    reflection: note || "No reflection note recorded."
  };

  state.history.push(entry);
  state.currentRoute = null;
  state.activeSlotIndex = 0;
  
  state.backlog.forEach(t => { t.completed = false; });
  document.getElementById('reflection-input').value = '';

  saveStateToLocalStorage();
  renderHistory();
  renderBacklog();
  updateViewVisibility();
  switchTab('onboarding');
  showToast("Day archived successfully! Logs synced to memory.");
}

// --- PWA INITIALIZATION AND LOGS ---
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installContainer = document.getElementById('pwa-install-container');
  if (installContainer) installContainer.style.display = 'block';
});
