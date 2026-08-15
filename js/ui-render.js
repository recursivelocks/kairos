// Kairos GPS - UI Rendering engine
import { state, saveStateToLocalStorage, milestoneManager } from './state.js';
import { getLiveSlotIndex } from './utils.js';

const STRATEGIES = {
  pomodoro: { name: 'Pomodoro (25/5)', focusMins: 25, breakMins: 5 },
  timebox: { name: 'Time-Boxing (50/10)', focusMins: 50, breakMins: 10 },
  frog: { name: 'Eat the Frog (Deep Work)', focusMins: 90, breakMins: 15 },
  micro: { name: '10-Min Microtasks', focusMins: 10, breakMins: 2 },
  rest: { name: 'Mindful Recharge', focusMins: 15, breakMins: 0 },
  routine: { name: 'Mindful Start/End', focusMins: 30, breakMins: 0 }
};

/**
 * Render the main daily route timeline view
 */
export function renderTimeline() {
  if (!state.currentRoute) return;

  // Sync unassigned backlog tasks dynamically
  milestoneManager.syncUnassignedTasks(state.currentRoute.slots);

  const liveSlotIndex = getLiveSlotIndex(state.currentRoute.slots);

  // Toggle warning banner
  const syncBanner = document.getElementById('timeline-sync-banner');
  if (syncBanner) {
    if (liveSlotIndex !== -1 && state.activeSlotIndex !== liveSlotIndex) {
      syncBanner.style.display = 'flex';
      syncBanner.innerHTML = `
        <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">🛰️ Route coordinates out of sync with real-time clock.</span>
        <button onclick="syncFocusToLiveSlot(${liveSlotIndex})" class="btn-primary" style="font-size: 11px; padding: 6px 12px; border-radius: var(--radius-sm); font-weight: 700; margin: 0; cursor: pointer;">Sync GPS</button>
      `;
    } else {
      syncBanner.style.display = 'none';
    }
  }

  document.getElementById('date-label').textContent = state.currentRoute.date;
  const container = document.getElementById('timeline-slots-container');
  container.innerHTML = '';

  let completedCount = 0;

  // 1. Render Start Pin
  const startItem = document.createElement('div');
  startItem.className = 'timeline-item';
  startItem.innerHTML = `
    <div class="timeline-node origin-pin"></div>
    <div class="timeline-card" style="background: rgba(16, 185, 129, 0.05); border-color: rgba(16, 185, 129, 0.15); cursor: default; pointer-events: none;">
      <div class="time-slot" style="color: var(--accent-success); font-weight: 800;">Wake Coordinates: ${state.currentRoute.wakeTime || '07:00'}</div>
      <div class="timeline-title" style="font-weight: 700; color: var(--accent-success)">🏁 Route Commenced</div>
    </div>
  `;
  container.appendChild(startItem);

  // 2. Render landmarks
  state.currentRoute.slots.forEach((slot, index) => {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    
    const isLive = (index === liveSlotIndex);
    if (isLive) {
      item.classList.add('active');
    }
    if (slot.completed) {
      item.classList.add('completed');
      completedCount++;
    }

    const stratName = STRATEGIES[slot.strategy] ? STRATEGIES[slot.strategy].name : slot.strategy;

    let milestonesHTML = '';
    if (slot.milestones && slot.milestones.length > 0) {
      const doneCount = slot.milestones.filter(m => m.completed).length;
      milestonesHTML = `
        <div style="margin-top: 10px; border-top: 1px dashed var(--glass-border); padding-top: 8px;">
          <div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px; display: flex; justify-content: space-between;">
            <span>Milestones</span>
            <span>${doneCount}/${slot.milestones.length} done</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${slot.milestones.map((m, mIdx) => {
              const mText = typeof m === 'string' ? m : m.text;
              const mCompleted = typeof m === 'string' ? false : m.completed;
              return `
                <div onclick="event.stopPropagation();" style="font-size: 13px; display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px 0;">
                  <input type="checkbox" onchange="toggleTimelineMilestone(${index}, ${mIdx})" ${mCompleted ? 'checked' : ''} style="width: 14px; height: 14px; cursor: pointer; accent-color: #1877F2; margin: 0;">
                  <span style="${mCompleted ? 'text-decoration: line-through; opacity: 0.6; color: var(--text-muted);' : 'color: var(--text-primary); font-weight: 500;'}">${mText}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    item.innerHTML = `
      <div class="timeline-node ${isLive ? 'live-node' : ''}"></div>
      <div class="timeline-card" onclick="openEditSlotModal(${index})">
        <div class="timeline-card-header">
          <div>
            <div class="time-slot" style="display: flex; align-items: center; gap: 6px;">
              <span>${slot.startTime} - ${slot.endTime}</span>
              ${isLive ? `<span class="live-badge" style="background: var(--accent-primary); color: #fff; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 10px;">LIVE NOW</span>` : ''}
            </div>
            <div class="timeline-title">${slot.title}</div>
            <div style="font-size: 12px; color: var(--text-secondary);">${slot.pillar}</div>
          </div>
          <button class="btn-timeline-focus" onclick="event.stopPropagation(); selectActiveSlot(${index});" title="Start Focus Mode">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
        <div class="timeline-strategy-badge">
          <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align: middle;"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          ${stratName}
        </div>
        ${milestonesHTML}
      </div>
    `;

    container.appendChild(item);
  });

  // 3. Render End Pin
  const endItem = document.createElement('div');
  endItem.className = 'timeline-item';
  endItem.style.marginBottom = '0';
  endItem.innerHTML = `
    <div class="timeline-node destination-pin"></div>
    <div class="timeline-card" style="background: rgba(239, 68, 68, 0.03); border-color: rgba(239, 68, 68, 0.15); cursor: default; pointer-events: none;">
      <div class="time-slot" style="color: var(--accent-danger); font-weight: 800;">Sleep coordinates: ${state.currentRoute.sleepTime || '23:00'}</div>
      <div class="timeline-title" style="font-weight: 700; color: var(--accent-danger)">🎯 Destination Locked</div>
    </div>
  `;
  container.appendChild(endItem);

  // Update progress line height
  const items = container.querySelectorAll('.timeline-item');
  const progressLine = document.getElementById('timeline-progress-line');
  if (items.length > 0 && progressLine) {
    const totalSlots = items.length;
    const activeIdx = state.activeSlotIndex + 1;
    const pct = Math.min(100, Math.max(0, (activeIdx / (totalSlots - 1)) * 100));
    progressLine.style.height = `${pct}%`;
  }

  // Update progress widgets
  const totalSlotsCount = state.currentRoute.slots.length;
  const compliancePct = Math.round((completedCount / totalSlotsCount) * 100);
  document.getElementById('compliance-percentage').textContent = `${compliancePct}%`;

  const circleBar = document.getElementById('compliance-bar');
  if (circleBar) {
    const circumference = 2 * Math.PI * 27;
    const offset = circumference - (compliancePct / 100) * circumference;
    circleBar.style.strokeDashoffset = offset;
  }

  const statusLabel = document.getElementById('compliance-status');
  if (statusLabel) {
    if (compliancePct === 0) {
      statusLabel.textContent = "Route Commenced. GPS tracking active.";
    } else if (compliancePct < 50) {
      statusLabel.textContent = "Drift Warning. Correct course parameters.";
    } else if (compliancePct < 90) {
      statusLabel.textContent = "On track. Navigation compliance high.";
    } else {
      statusLabel.textContent = "Destination reached. Focus aligned.";
    }
  }
}

/**
 * Configure target Focus view components
 */
export function setupActiveFocusBlock() {
  if (!state.currentRoute) return;
  const slot = state.currentRoute.slots[state.activeSlotIndex];
  if (!slot) return;

  document.getElementById('focus-pillar').textContent = slot.pillar;
  document.getElementById('focus-task-title').textContent = slot.title;

  const strat = STRATEGIES[slot.strategy];
  document.getElementById('focus-strategy-name').textContent = `Strategy: ${strat ? strat.name : slot.strategy}`;

  const sectionEl = document.getElementById('focus-milestones-section');
  const listEl = document.getElementById('focus-milestones-list');

  if (slot.milestones && slot.milestones.length > 0) {
    sectionEl.style.display = 'block';
    listEl.innerHTML = '';
    
    slot.milestones.forEach((milestone, idx) => {
      const mText = typeof milestone === 'string' ? milestone : milestone.text;
      const mCompleted = typeof milestone === 'string' ? false : milestone.completed;

      const row = document.createElement('label');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '10px';
      row.style.fontSize = '14px';
      row.style.cursor = 'pointer';
      row.style.padding = '10px 12px';
      row.style.background = 'var(--bg-secondary)';
      row.style.borderRadius = 'var(--radius-sm)';
      row.style.border = '1px solid var(--glass-border)';
      row.style.transition = 'var(--transition-smooth)';
      
      row.innerHTML = `
        <input type="checkbox" onchange="toggleFocusMilestone(${idx})" ${mCompleted ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;">
        <span style="${mCompleted ? 'text-decoration: line-through; color: var(--text-muted);' : 'color: var(--text-primary); font-weight: 500;'}">${mText}</span>
      `;
      listEl.appendChild(row);
    });
  } else {
    sectionEl.style.display = 'none';
  }

  const reflectionCard = document.getElementById('reflection-card');
  if (reflectionCard) {
    if (state.activeSlotIndex === state.currentRoute.slots.length - 1 && slot.completed) {
      reflectionCard.style.display = 'block';
    } else {
      reflectionCard.style.display = 'none';
    }
  }

  // Pre-fill timer settings if inactive
  if (!state.timer.isRunning) {
    const durationMins = strat ? strat.focusMins : slot.duration;
    state.timer.duration = durationMins * 60;
    state.timer.remaining = state.timer.duration;
    state.timer.type = 'focus';
    updateTimerDisplay();
  }
}

/**
 * Updates the focus screen timer visuals
 */
export function updateTimerDisplay() {
  const m = Math.floor(state.timer.remaining / 60);
  const s = state.timer.remaining % 60;
  document.getElementById('timer-display').textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  
  const circleBar = document.getElementById('timer-progress');
  if (circleBar) {
    const circumference = 2 * Math.PI * 100;
    let percent = 0;
    if (state.timer.duration > 0) {
      percent = state.timer.remaining / state.timer.duration;
    }
    circleBar.style.strokeDashoffset = circumference - (percent * circumference);
  }
  
  const label = document.getElementById('timer-state-label');
  if (label) {
    if (state.timer.type === 'focus') {
      label.textContent = 'Focus Session';
      label.style.color = 'var(--accent-primary)';
    } else {
      label.textContent = 'Recharge Break';
      label.style.color = 'var(--accent-success)';
    }
  }
}

/**
 * Render general backlog checklist on settings
 */
export function renderBacklog() {
  const container = document.getElementById('backlog-list');
  if (!container) return;
  container.innerHTML = '';
  
  if (state.backlog.length === 0) {
    container.innerHTML = `<span style="font-size: 13px; color: var(--text-muted); font-style: italic;">No tasks added yet. Backlog is clear.</span>`;
    return;
  }

  state.backlog.forEach(task => {
    const chip = document.createElement('div');
    chip.className = 'tag-chip';
    chip.style.display = 'flex';
    chip.style.alignItems = 'center';
    chip.style.justifyContent = 'space-between';
    chip.style.width = '100%';
    chip.style.padding = '8px 12px';
    chip.style.marginBottom = '6px';
    
    chip.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" onchange="toggleBacklogTaskStatus('${task.id}')" ${task.completed ? 'checked' : ''} style="width: 15px; height: 15px; cursor: pointer;">
        <span style="${task.completed ? 'text-decoration: line-through; opacity: 0.6; color: var(--text-muted);' : 'color: var(--text-primary); font-weight: 500;'}">
          [Pillar ${task.pillarId === '1' ? 'A' : task.pillarId === '2' ? 'B' : 'C'}] ${task.text}
        </span>
      </div>
      <button onclick="removeTaskFromBacklog('${task.id}')" style="background: none; border: none; font-size: 16px; color: var(--text-muted); cursor: pointer; padding: 0 4px;">&times;</button>
    `;
    container.appendChild(chip);
  });
}

/**
 * Render the Backlog list chips on the Compass tab
 */
export function renderCompassBacklog() {
  const container = document.getElementById('compass-backlog-list');
  if (!container) return;
  container.innerHTML = '';
  
  if (state.backlog.length === 0) {
    container.innerHTML = `<span style="font-size: 13px; color: var(--text-muted); font-style: italic;">No tasks in backlog.</span>`;
    return;
  }

  state.backlog.forEach(task => {
    const chip = document.createElement('div');
    chip.className = 'tag-chip';
    chip.style.display = 'flex';
    chip.style.alignItems = 'center';
    chip.style.justifyContent = 'space-between';
    chip.style.width = '100%';
    chip.style.padding = '8px 12px';
    
    chip.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" onchange="toggleBacklogTaskStatus('${task.id}')" ${task.completed ? 'checked' : ''} style="width: 15px; height: 15px; cursor: pointer;">
        <span style="${task.completed ? 'text-decoration: line-through; opacity: 0.6; color: var(--text-muted);' : 'color: var(--text-primary); font-weight: 500;'}">
          [Pillar ${task.pillarId === '1' ? 'A' : task.pillarId === '2' ? 'B' : 'C'}] ${task.text}
        </span>
      </div>
      <button onclick="removeTaskFromBacklog('${task.id}')" style="background: none; border: none; font-size: 16px; color: var(--text-muted); cursor: pointer; padding: 0 4px;">&times;</button>
    `;
    container.appendChild(chip);
  });
}

/**
 * Renders the True North Compass tab parameters
 */
export function renderCompass() {
  renderCompassBacklog();

  if (!state.pillars) {
    state.pillars = { 1: 'Career Growth', 2: 'Physical Health', 3: 'Mental Rest' };
  }
  if (!state.compass) {
    state.compass = {
      motto: 'Focus on what you can control.',
      pillarDescriptions: {
        1: 'Build sustainable value and master my craft.',
        2: 'Move daily, sleep well, and eat clean.',
        3: 'Unplug daily and cultivate present-moment awareness.'
      },
      reminders: []
    };
  }

  document.getElementById('compass-motto-input').value = state.compass.motto;

  document.getElementById('lbl-pillar-1').textContent = `${state.pillars[1] || 'Pillar A'} Description`;
  document.getElementById('lbl-pillar-2').textContent = `${state.pillars[2] || 'Pillar B'} Description`;
  document.getElementById('lbl-pillar-3').textContent = `${state.pillars[3] || 'Pillar C'} Description`;

  const compassPillarSel = document.getElementById('compass-task-pillar-select');
  if (compassPillarSel && compassPillarSel.options.length >= 3) {
    compassPillarSel.options[0].text = state.pillars[1] || 'Pillar A';
    compassPillarSel.options[1].text = state.pillars[2] || 'Pillar B';
    compassPillarSel.options[2].text = state.pillars[3] || 'Pillar C';
  }

  document.getElementById('compass-desc-1').value = state.compass.pillarDescriptions[1] || '';
  document.getElementById('compass-desc-2').value = state.compass.pillarDescriptions[2] || '';
  document.getElementById('compass-desc-3').value = state.compass.pillarDescriptions[3] || '';

  const listContainer = document.getElementById('reminders-list');
  listContainer.innerHTML = '';
  
  if (state.compass.reminders.length === 0) {
    listContainer.innerHTML = `<span style="font-size: 13px; color: var(--text-muted); font-style: italic; text-align: center;">No custom reminders set. Add rules to keep on course.</span>`;
    return;
  }

  state.compass.reminders.forEach((reminder, index) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.style.padding = '10px 14px';
    item.style.marginBottom = '6px';
    
    item.innerHTML = `
      <span style="font-size: 13px; font-weight: 500; color: var(--text-primary);">💡 ${reminder}</span>
      <button onclick="removeCompassReminder(${index})" style="background: none; border: none; font-size: 16px; color: var(--text-muted); cursor: pointer; padding: 0 4px;">&times;</button>
    `;
    listContainer.appendChild(item);
  });
}

/**
 * Render history sync records and consistency averages
 */
export function renderHistory() {
  const listContainer = document.getElementById('history-entries');
  const consistencyLabel = document.getElementById('stat-consistency');
  const countLabel = document.getElementById('stat-days-tracked');

  if (state.history.length === 0) {
    listContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); margin-top: 20px; font-style: italic;">No logged history yet. Complete your first day route to start sync.</p>`;
    consistencyLabel.textContent = "0%";
    countLabel.textContent = "0";
    return;
  }

  countLabel.textContent = state.history.length;

  let totalAccuracy = 0;
  listContainer.innerHTML = '';

  state.history.forEach(entry => {
    totalAccuracy += entry.accuracy;
    
    const item = document.createElement('div');
    item.className = 'history-item';
    
    const pillarsUsed = entry.pillarsUsed || [];
    const tagsHtml = pillarsUsed.map(p => `<span class="history-pill completed">${p}</span>`).join(' ');
    
    const tasksCompleted = entry.tasksCompleted || 0;
    const tasksTotal = entry.tasksTotal || 0;
    const reflectionText = entry.reflection || "No reflection recorded.";

    item.innerHTML = `
      <div class="history-header">
        <span>${entry.date}</span>
        <span style="color: var(--accent-primary); font-weight: 700;">Accuracy: ${entry.accuracy}%</span>
      </div>
      <div style="font-size: 13px; margin-bottom: 8px; font-weight: 500;">
        Route Goals: ${tasksCompleted} / ${tasksTotal} slots completed
      </div>
      <div class="history-pill-container">
        ${tagsHtml}
      </div>
      <div class="history-reflection">
        "${reflectionText}"
      </div>
    `;

    listContainer.appendChild(item);
  });

  const avgConsistency = Math.round(totalAccuracy / state.history.length);
  consistencyLabel.textContent = `${avgConsistency}%`;
}

/**
 * Manage tab view visibilities
 */
export function updateViewVisibility() {
  const views = ['onboarding', 'compass', 'timeline', 'focus', 'history'];
  let activeView = 'onboarding';
  
  if (state.currentRoute) {
    activeView = 'timeline';
  }

  const activeTab = document.querySelector('.tab-bar .tab-btn.active');
  if (activeTab) {
    const tabView = activeTab.dataset.view;
    if (tabView === 'compass') {
      activeView = 'compass';
    } else if (tabView === 'history') {
      activeView = 'history';
    } else if (tabView === 'focus') {
      if (state.currentRoute) {
        activeView = 'focus';
      } else {
        activeView = 'onboarding';
        document.querySelectorAll('.tab-bar .tab-btn').forEach(btn => {
          if (btn.dataset.view === 'timeline') btn.classList.add('active');
          else btn.classList.remove('active');
        });
      }
    } else if (tabView === 'timeline') {
      activeView = state.currentRoute ? 'timeline' : 'onboarding';
    }
  }

  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) {
      if (v === activeView) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    }
  });

  const tabContainer = document.querySelector('.tab-bar');
  if (tabContainer) {
    tabContainer.style.display = 'flex';
  }
}

/**
 * Switches the active tab view layer
 * @param {string} viewName 
 */
export function switchTab(viewName) {
  if (viewName === 'focus' && !state.currentRoute) {
    alert("Route not assembled yet. Please assemble first!");
    viewName = 'timeline';
  }

  document.querySelectorAll('.tab-bar .tab-btn').forEach(btn => {
    if (btn.dataset.view === viewName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (viewName === 'timeline') {
    renderTimeline();
  } else if (viewName === 'focus') {
    setupActiveFocusBlock();
  } else if (viewName === 'compass') {
    renderCompass();
  } else if (viewName === 'history') {
    renderHistory();
  }

  updateViewVisibility();
}

/**
 * Align focus slot selection index to local device clock hour.
 */
export function syncActiveSlotWithLocalTime() {
  if (!state.currentRoute || !state.currentRoute.slots) return;

  const liveIndex = getLiveSlotIndex(state.currentRoute.slots);
  if (liveIndex !== -1 && state.activeSlotIndex !== liveIndex) {
    if (!state.timer.isRunning) {
      state.activeSlotIndex = liveIndex;
      saveStateToLocalStorage();
      renderTimeline();
      setupActiveFocusBlock();
      console.log(`Local Time Sync: Automatically aligned focus coordinates to index ${liveIndex}`);
    }
  } else {
    renderTimeline();
  }
}

/**
 * Select focus slot target index manually.
 */
export function selectActiveSlot(index) {
  state.activeSlotIndex = index;
  state.timer.isRunning = false;
  if (state.timer.intervalId) {
    clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
  }
  
  saveStateToLocalStorage();
  renderTimeline();
  setupActiveFocusBlock();
  switchTab('focus');
}

/**
 * Toggle backlog check states
 */
export function toggleBacklogTaskStatus(taskId) {
  milestoneManager.toggleTaskStatus(taskId);
}

/**
 * Remove task card from the backlog list
 */
export function removeTaskFromBacklog(id) {
  milestoneManager.removeTask(id);
}

/**
 * Remove custom reminders from Compass
 */
export function removeCompassReminder(index) {
  state.compass.reminders.splice(index, 1);
  saveStateToLocalStorage();
  renderCompass();
}

/**
 * Toggle milestones completion in Timeline
 */
export function toggleTimelineMilestone(slotIdx, milestoneIdx) {
  const slot = state.currentRoute.slots[slotIdx];
  milestoneManager.toggleMilestone(slot, milestoneIdx);
}

/**
 * Toggle milestones completion in Focus View
 */
export function toggleFocusMilestone(milestoneIdx) {
  const slot = state.currentRoute.slots[state.activeSlotIndex];
  milestoneManager.toggleMilestone(slot, milestoneIdx);
}

/**
 * Launches Adjust Coordinates modal for a specific index
 */
export function openEditSlotModal(index) {
  if (!state.currentRoute) return;
  const slot = state.currentRoute.slots[index];
  if (!slot) return;

  document.getElementById('edit-slot-index').value = index;
  document.getElementById('edit-slot-title').value = slot.title;
  document.getElementById('edit-slot-strategy').value = slot.strategy;

  const modal = document.getElementById('edit-slot-modal');
  modal.classList.add('active');
}

/**
 * Closes the Adjust Coordinates modal
 */
export function closeEditSlotModal() {
  document.getElementById('edit-slot-modal').classList.remove('active');
}

/**
 * Explicit GPS synchronizer click handler
 */
export function syncFocusToLiveSlot(index) {
  if (!state.currentRoute || !state.currentRoute.slots) return;
  state.activeSlotIndex = index;
  saveStateToLocalStorage();
  renderTimeline();
  setupActiveFocusBlock();
}

// Bind functions to the window object to support inline onclick HTML triggers in dynamically rendered cards
window.selectActiveSlot = selectActiveSlot;
window.toggleTimelineMilestone = toggleTimelineMilestone;
window.toggleFocusMilestone = toggleFocusMilestone;
window.toggleBacklogTaskStatus = toggleBacklogTaskStatus;
window.removeTaskFromBacklog = removeTaskFromBacklog;
window.removeCompassReminder = removeCompassReminder;
window.openEditSlotModal = openEditSlotModal;
window.syncFocusToLiveSlot = syncFocusToLiveSlot;
