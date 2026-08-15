// Kairos GPS - Prescriptive Daily Route & Landmark Re-routing Engine
import { state, saveStateToLocalStorage, milestoneManager, stopTimer } from './state.js';
import { parseMins, formatTime } from './utils.js';
import {
  renderTimeline,
  setupActiveFocusBlock,
  updateViewVisibility,
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

/**
 * Re-align downstream slots starting times sequentially.
 * @param {number} startIndex 
 * @param {number} startPos Minutes of day
 */
function realignDownstreamSlots(startIndex, startPos) {
  let trackPos = startPos;
  for (let i = startIndex; i < state.currentRoute.slots.length; i++) {
    const slot = state.currentRoute.slots[i];
    slot.startTime = formatTime(trackPos);
    slot.endTime = formatTime(trackPos + slot.duration);
    trackPos += slot.duration;
  }
}

/**
 * Generates the prescriptive daily route from waking window constraints.
 */
export function generateDailyRoute() {
  const wakeStr = document.getElementById('wake-time').value;
  const sleepStr = document.getElementById('sleep-time').value;
  const energyPeak = document.getElementById('energy-peak').value;

  // Reset backlog task completion states for the new daily route
  if (state.backlog) {
    state.backlog.forEach(t => { t.completed = false; });
  }

  const today = new Date();
  const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  const dateStr = today.toLocaleDateString('en-US', dateOptions);

  const [wakeH, wakeM] = wakeStr.split(':').map(Number);
  const [sleepH, sleepM] = sleepStr.split(':').map(Number);

  let startMinutes = wakeH * 60 + wakeM;
  let endMinutes = sleepH * 60 + sleepM;
  if (endMinutes < startMinutes) endMinutes += 24 * 60; // Handle overnight slots

  const totalWakingMins = endMinutes - startMinutes;
  
  if (totalWakingMins < 240) {
    alert("Awake duration must be at least 4 hours.");
    return;
  }

  const routineMins = 45;
  const rechargeMins = 60;
  const windDownMins = 45;
  
  const flexMins = totalWakingMins - (routineMins + rechargeMins + windDownMins);
  const deepMins = Math.round(flexMins * 0.6);
  const secondaryMins = flexMins - deepMins;

  const assignedTaskIds = new Set();
  const popTaskFromBacklog = (pillarId) => {
    const idx = state.backlog.findIndex(t => t.pillarId === pillarId && !assignedTaskIds.has(t.id));
    if (idx !== -1) {
      const task = state.backlog[idx];
      assignedTaskIds.add(task.id);
      return task.text;
    }
    return `Align with ${state.pillars[pillarId]}`;
  };

  const slots = [];
  let currentPos = startMinutes;

  const morningMilestones = state.backlog
    .filter(t => !t.completed)
    .map(t => ({
      text: t.text,
      taskId: t.id,
      completed: false
    }));

  // 1. Morning Routine
  slots.push({
    title: 'Morning Routines & Compass Alignment',
    type: 'routine',
    duration: routineMins,
    startTime: formatTime(currentPos),
    endTime: formatTime(currentPos + routineMins),
    pillar: 'Mental Rest',
    strategy: 'routine',
    completed: false,
    milestones: morningMilestones
  });
  currentPos += routineMins;

  // 2 & 4: Deep focus and secondary focus order depends on energyPeak
  if (energyPeak === 'morning') {
    slots.push({
      title: popTaskFromBacklog('1'),
      type: 'intention_deep',
      duration: deepMins,
      startTime: formatTime(currentPos),
      endTime: formatTime(currentPos + deepMins),
      pillar: state.pillars[1],
      strategy: 'frog',
      completed: false
    });
    currentPos += deepMins;

    slots.push({
      title: 'Mid-Day Rest & Reset Break',
      type: 'rest',
      duration: rechargeMins,
      startTime: formatTime(currentPos),
      endTime: formatTime(currentPos + rechargeMins),
      pillar: 'Mental Rest',
      strategy: 'rest',
      completed: false
    });
    currentPos += rechargeMins;

    slots.push({
      title: popTaskFromBacklog('2'),
      type: 'intention_secondary',
      duration: secondaryMins,
      startTime: formatTime(currentPos),
      endTime: formatTime(currentPos + secondaryMins),
      pillar: state.pillars[2],
      strategy: 'timebox',
      completed: false
    });
    currentPos += secondaryMins;

  } else {
    // Afternoon Energy peak
    slots.push({
      title: popTaskFromBacklog('2'),
      type: 'intention_secondary',
      duration: secondaryMins,
      startTime: formatTime(currentPos),
      endTime: formatTime(currentPos + secondaryMins),
      pillar: state.pillars[2],
      strategy: 'timebox',
      completed: false
    });
    currentPos += secondaryMins;

    slots.push({
      title: 'Mid-Day Rest & Reset Break',
      type: 'rest',
      duration: rechargeMins,
      startTime: formatTime(currentPos),
      endTime: formatTime(currentPos + rechargeMins),
      pillar: 'Mental Rest',
      strategy: 'rest',
      completed: false
    });
    currentPos += rechargeMins;

    slots.push({
      title: popTaskFromBacklog('1'),
      type: 'intention_deep',
      duration: deepMins,
      startTime: formatTime(currentPos),
      endTime: formatTime(currentPos + deepMins),
      pillar: state.pillars[1],
      strategy: 'frog',
      completed: false
    });
    currentPos += deepMins;
  }

  // 5. Evening wind down
  slots.push({
    title: 'Day Audit & Evening Wind-Down',
    type: 'reflection',
    duration: windDownMins,
    startTime: formatTime(currentPos),
    endTime: formatTime(currentPos + windDownMins),
    pillar: 'Mental Rest',
    strategy: 'routine',
    completed: false
  });

  state.currentRoute = {
    date: dateStr,
    wakeTime: wakeStr,
    sleepTime: sleepStr,
    slots: slots
  };
  state.activeSlotIndex = 0;
}

/**
 * Resets the active daily route.
 */
export function resetCurrentRoute() {
  state.currentRoute = null;
  state.activeSlotIndex = 0;
  stopTimer();
  
  state.backlog.forEach(t => { t.completed = false; });
  
  saveStateToLocalStorage();
  updateViewVisibility();
  renderBacklog();
}

/**
 * Completes the active focus slot and advances.
 */
export function completeActiveSlot() {
  if (!state.currentRoute) return;
  stopTimer();

  const slot = state.currentRoute.slots[state.activeSlotIndex];
  slot.completed = true;

  milestoneManager.completeAllSlotMilestones(slot);

  if (state.activeSlotIndex < state.currentRoute.slots.length - 1) {
    state.activeSlotIndex++;
  }

  saveStateToLocalStorage();
  renderTimeline();
  setupActiveFocusBlock();
  updateViewVisibility();
}

/**
 * Save edits to a specific coordinate slot from the modal input.
 */
export function saveSlotEdit() {
  const index = parseInt(document.getElementById('edit-slot-index').value, 10);
  if (isNaN(index) || !state.currentRoute) return;

  const slot = state.currentRoute.slots[index];
  const newTitle = document.getElementById('edit-slot-title').value.trim();
  const newStrategy = document.getElementById('edit-slot-strategy').value;

  if (newTitle) {
    slot.title = newTitle;
    slot.strategy = newStrategy;
    
    // Auto sync strategy focus times if timer isn't running
    if (state.activeSlotIndex === index && !state.timer.isRunning) {
      const strat = STRATEGIES[newStrategy];
      if (strat) {
        state.timer.duration = strat.focusMins * 60;
        state.timer.remaining = state.timer.duration;
      }
    }
  }

  saveStateToLocalStorage();
  renderTimeline();
  setupActiveFocusBlock();
  
  // Close modal
  document.getElementById('edit-slot-modal').classList.remove('active');
}

/**
 * Apply dynamic scheduling re-routing logic.
 */
export function applyRecalculation() {
  const selected = document.querySelector('.recalculate-card.selected');
  if (!selected) {
    alert("Please select a recalculation criteria.");
    return;
  }

  const reason = selected.dataset.reason;
  const currentSlotIndex = state.activeSlotIndex;
  const currentSlot = state.currentRoute.slots[currentSlotIndex];

  stopTimer();

  if (reason === 'distracted') {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    let diff = currentMins - parseMins(currentSlot.startTime);
    if (diff > 0) {
      // Shift downstream slots forward
      realignDownstreamSlots(currentSlotIndex, parseMins(currentSlot.startTime) + diff);
      
      const lastSlot = state.currentRoute.slots[state.currentRoute.slots.length - 1];
      const sleepLimit = parseMins(document.getElementById('sleep-time').value);
      
      if (parseMins(lastSlot.endTime) > sleepLimit) {
        let overflow = parseMins(lastSlot.endTime) - sleepLimit;
        
        for (let i = state.currentRoute.slots.length - 2; i > currentSlotIndex; i--) {
          const slot = state.currentRoute.slots[i];
          if (slot.type === 'flex' || slot.type === 'intention_admin') {
            const shrink = Math.min(overflow, slot.duration - 20);
            if (shrink > 0) {
              slot.duration -= shrink;
              overflow -= shrink;
            }
          }
        }
        
        realignDownstreamSlots(currentSlotIndex, parseMins(currentSlot.startTime));
      }
    }

  } else if (reason === 'energy') {
    currentSlot.strategy = 'micro';
    currentSlot.title = `Low Energy Checklist: ${currentSlot.title}`;
    
    const origDuration = currentSlot.duration;
    currentSlot.duration = 20; 
    const diff = origDuration - 20;
    
    let trackPos = parseMins(currentSlot.startTime) + currentSlot.duration;
    
    for (let i = currentSlotIndex + 1; i < state.currentRoute.slots.length; i++) {
      const slot = state.currentRoute.slots[i];
      if (slot.type === 'rest' || slot.type === 'flex') {
        slot.duration += diff;
        break; 
      }
    }

    realignDownstreamSlots(currentSlotIndex + 1, trackPos);

  } else if (reason === 'overrun') {
    currentSlot.duration += 30;
    let overflow = 30;
    
    for (let i = state.currentRoute.slots.length - 2; i > currentSlotIndex; i--) {
      const slot = state.currentRoute.slots[i];
      if (slot.type === 'flex' || slot.type === 'intention_secondary') {
        const shrink = Math.min(overflow, slot.duration - 20);
        if (shrink > 0) {
          slot.duration -= shrink;
          overflow -= shrink;
        }
      }
    }

    if (overflow > 0) {
      const flexIdx = state.currentRoute.slots.findIndex(s => s.type === 'flex' && !s.completed);
      if (flexIdx !== -1 && flexIdx > currentSlotIndex) {
        state.currentRoute.slots.splice(flexIdx, 1);
      }
    }

    const trackPos = parseMins(currentSlot.startTime) + currentSlot.duration;
    currentSlot.endTime = formatTime(trackPos);

    realignDownstreamSlots(currentSlotIndex + 1, trackPos);

  } else if (reason === 'rest') {
    const restSlot = {
      title: 'Emergency Rest Stop',
      type: 'rest',
      duration: 15,
      startTime: currentSlot.startTime,
      endTime: formatTime(parseMins(currentSlot.startTime) + 15),
      pillar: 'Mental Rest',
      strategy: 'rest',
      completed: true
    };

    state.currentRoute.slots.splice(currentSlotIndex, 0, restSlot);
    realignDownstreamSlots(currentSlotIndex + 1, parseMins(restSlot.endTime));
    state.activeSlotIndex++;
  }

  saveStateToLocalStorage();
  renderTimeline();
  setupActiveFocusBlock();
  document.getElementById('recalculate-overlay').classList.remove('active');
}
