// Kairos GPS - Central State Definition & Storage Managers
import { MilestoneManager } from './milestones.js?v=16';

export let state = {
  pillars: {
    1: 'Career Growth',
    2: 'Physical Health',
    3: 'Mental Rest'
  },
  backlog: [], // Array of { id, text, pillarId, completed }
  currentRoute: null, // Current active daily route: { date, slots: [] }
  activeSlotIndex: 0,
  timer: {
    duration: 0, // In seconds
    remaining: 0, // In seconds
    isRunning: false,
    intervalId: null,
    type: 'focus' // focus, break, rest
  },
  history: [], // Array of completed days
  theme: 'cream',
  compass: {
    motto: 'Focus on what you can control.',
    pillarDescriptions: {
      1: 'Build sustainable value and master my craft.',
      2: 'Move daily, sleep well, and eat clean.',
      3: 'Unplug daily and cultivate present-moment awareness.'
    },
    reminders: [
      'Action cures fear. Take the first step.',
      'One intention at a time.'
    ]
  }
};

export const milestoneManager = new MilestoneManager(state);

/**
 * Safely merge new values into the central state object.
 * @param {Object} parsed 
 */
export function mergeState(parsed) {
  if (!parsed) return;
  if (parsed.pillars) state.pillars = parsed.pillars;
  if (parsed.backlog) state.backlog = parsed.backlog;
  if (parsed.currentRoute) state.currentRoute = parsed.currentRoute;
  if (typeof parsed.activeSlotIndex === 'number') state.activeSlotIndex = parsed.activeSlotIndex;
  if (parsed.history) state.history = parsed.history;
  if (parsed.theme) state.theme = parsed.theme;
  if (parsed.compass) state.compass = parsed.compass;
  if (parsed.timer) {
    state.timer = parsed.timer;
    state.timer.isRunning = false;
    state.timer.intervalId = null;
  }
}

/**
 * Serialize state to local storage.
 */
let onStateSaveCallback = null;

export function setOnStateSave(cb) {
  onStateSaveCallback = cb;
}

export function saveStateToLocalStorage() {
  localStorage.setItem('kairos_state', JSON.stringify(state));
  if (onStateSaveCallback) {
    onStateSaveCallback();
  }
}

/**
 * Stop active timers
 */
export function stopTimer() {
  state.timer.isRunning = false;
  if (state.timer.intervalId) {
    clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
  }
}

/**
 * Restore state keys safely from local storage.
 */
export function loadStateFromLocalStorage() {
  const saved = localStorage.getItem('kairos_state');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      mergeState(parsed);
    } catch (e) {
      console.error('Failed to parse local storage state:', e);
    }
  }
}
