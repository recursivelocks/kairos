// Kairos GPS - Centralized Milestones & Backlog Checklist State Machine Module

export class MilestoneManager {
  constructor(stateRef, callbacks = {}) {
    this.state = stateRef;
    this.callbacks = {
      onStateChange: () => {},
      showNotification: () => {},
      ...callbacks
    };
  }

  // Update notification listeners dynamically
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // Helper trigger to notify observers of any state changes
  notifyChange(msg = null) {
    this.callbacks.onStateChange();
    if (msg) {
      this.callbacks.showNotification(msg);
    }
  }

  // Append a new task to the backlog state queue
  addTask(text, pillarId) {
    if (!this.state.backlog) {
      this.state.backlog = [];
    }
    
    // Safety check: avoid duplicates
    const isDuplicate = this.state.backlog.some(t => t.text.toLowerCase() === text.toLowerCase());
    if (isDuplicate) {
      this.callbacks.showNotification("Task already exists in backlog!");
      return null;
    }

    const task = {
      id: Date.now().toString(),
      text: text,
      pillarId: pillarId,
      completed: false
    };
    
    this.state.backlog.push(task);
    this.notifyChange("Task added to backlog.");
    return task;
  }

  // Remove a task from the backlog state queue and clear any slot assignments
  removeTask(id) {
    const task = (this.state.backlog || []).find(t => t.id === id);
    if (!task) return;

    // Filter backlog
    this.state.backlog = (this.state.backlog || []).filter(t => t.id !== id);

    // Remove from all slots milestones list dynamically to avoid orphan assignments
    if (this.state.currentRoute && this.state.currentRoute.slots) {
      this.state.currentRoute.slots.forEach(slot => {
        if (slot.milestones) {
          slot.milestones = slot.milestones.filter(m => {
            const mText = typeof m === 'string' ? m : m.text;
            const mTaskId = typeof m === 'string' ? '' : m.taskId;
            return mTaskId !== id && mText !== task.text;
          });
        }
      });
    }

    this.notifyChange("Task removed from backlog.");
  }

  // Toggle backlog task status directly from Logs tab
  toggleTaskStatus(taskId) {
    const task = (this.state.backlog || []).find(t => t.id === taskId);
    if (!task) return;

    task.completed = !task.completed;

    // Propagate completion state directly to all route slot milestones if assigned
    if (this.state.currentRoute && this.state.currentRoute.slots) {
      this.state.currentRoute.slots.forEach(slot => {
        if (slot.milestones) {
          slot.milestones.forEach(m => {
            const mText = typeof m === 'string' ? m : m.text;
            const mTaskId = typeof m === 'string' ? '' : m.taskId;
            if (mTaskId === taskId || mText === task.text) {
              if (typeof m !== 'string') {
                m.completed = task.completed;
              }
            }
          });
        }
      });
    }

    this.notifyChange(task.completed ? "Task checked." : "Task unchecked.");
  }

  // Dynamic scheduler sync: compiles unassigned tasks into the first uncompleted slot's milestones
  syncUnassignedTasks(slots) {
    if (!slots) return;
    
    // Find the first uncompleted slot (defaulting to the first slot if all are somehow completed)
    const targetSlot = slots.find(s => !s.completed) || slots[0];
    if (!targetSlot) return;

    // Gather all task texts assigned as milestones to other slots
    const otherAssignedTexts = [];
    slots.forEach(s => {
      if (s !== targetSlot && s.milestones) {
        s.milestones.forEach(m => {
          otherAssignedTexts.push(typeof m === 'string' ? m : m.text);
        });
      }
    });

    // Filter backlog to only unassigned items, mapping completion status directly from the backlog task
    targetSlot.milestones = (this.state.backlog || [])
      .filter(t => t && t.text && !otherAssignedTexts.includes(t.text))
      .map(t => {
        return {
          text: t.text,
          taskId: t.id,
          completed: t.completed || false
        };
      });
  }

  // Toggle milestone completion state inside a slot and sync across backlog and other slot entries
  toggleMilestone(slot, milestoneIdx) {
    if (!slot || !slot.milestones) return;
    const milestone = slot.milestones[milestoneIdx];
    if (!milestone) return;

    const mText = typeof milestone === 'string' ? milestone : milestone.text;
    const mTaskId = typeof milestone === 'string' ? '' : milestone.taskId;

    // Toggle local milestone completion state
    const targetState = !(typeof milestone === 'string' ? false : milestone.completed);
    if (typeof milestone === 'string') {
      slot.milestones[milestoneIdx] = {
        text: mText,
        taskId: '',
        completed: targetState
      };
    } else {
      milestone.completed = targetState;
    }

    // 1. Sync back to backlog task status
    const backlogTask = (this.state.backlog || []).find(t => t.id === mTaskId || t.text === mText);
    if (backlogTask) {
      backlogTask.completed = targetState;
    }

    // 2. Propagate checked state to all other slot assignments containing this milestone
    if (this.state.currentRoute && this.state.currentRoute.slots) {
      this.state.currentRoute.slots.forEach(s => {
        if (s.milestones) {
          s.milestones.forEach(m => {
            const text = typeof m === 'string' ? m : m.text;
            const id = typeof m === 'string' ? '' : m.taskId;
            if ((mTaskId && id === mTaskId) || text === mText) {
              if (typeof m !== 'string') {
                m.completed = targetState;
              }
            }
          });
        }
      });
    }

    this.notifyChange(targetState ? "Milestone checked." : "Milestone unchecked.");
  }

  // Complete all milestones in a slot (e.g. on slot finalization) and archive them from lists
  completeAllSlotMilestones(slot) {
    if (!slot || !slot.milestones) return;
    
    const milestoneTexts = slot.milestones.map(m => typeof m === 'string' ? m : m.text);
    const milestoneIds = slot.milestones.map(m => typeof m === 'string' ? '' : m.taskId).filter(id => id);

    // Mark slot milestones completed
    slot.milestones.forEach(m => {
      if (typeof m === 'object' && m) {
        m.completed = true;
      }
    });

    // Remove all assigned milestones from the backlog since they are now completed/archived
    this.state.backlog = (this.state.backlog || []).filter(t => !milestoneIds.includes(t.id) && !milestoneTexts.includes(t.text));

    // Remove from other slots milestones list (since they are now archived)
    if (this.state.currentRoute && this.state.currentRoute.slots) {
      this.state.currentRoute.slots.forEach(s => {
        if (s !== slot && s.milestones) {
          s.milestones = s.milestones.filter(m => {
            const text = typeof m === 'string' ? m : m.text;
            const id = typeof m === 'string' ? '' : m.taskId;
            return !milestoneIds.includes(id) && !milestoneTexts.includes(text);
          });
        }
      });
    }

    this.notifyChange("Slot milestones completed & archived.");
  }

  // Assign specific tasks from backlog to slot
  assignToSlot(slot, selectedTaskIds) {
    if (!slot) return;
    const assigned = [];
    const backlogList = this.state.backlog || [];

    selectedTaskIds.forEach(id => {
      const task = backlogList.find(t => t.id === id);
      if (task) {
        const existing = (slot.milestones || [])
          .filter(m => m)
          .find(m => (typeof m === 'string' ? m : m.text) === task.text);
        assigned.push({
          text: task.text,
          taskId: task.id,
          completed: existing ? (typeof existing === 'string' ? false : existing.completed) : false
        });
      }
    });

    slot.milestones = assigned;
    this.notifyChange("Milestones updated.");
  }
}
