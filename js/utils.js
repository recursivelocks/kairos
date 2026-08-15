// Kairos GPS - Generic Time & Range Math Utility Helpers

/**
 * Display a toast notification on screen.
 * @param {string} message 
 */
export function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.style.background = 'var(--bg-secondary)';
  toast.style.color = 'var(--text-primary)';
  toast.style.padding = '10px 18px';
  toast.style.borderRadius = 'var(--radius-sm)';
  toast.style.fontSize = '13px';
  toast.style.fontWeight = '600';
  toast.style.border = '1.5px solid var(--accent-primary)';
  toast.style.boxShadow = 'var(--shadow-main)';
  toast.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(12px) scale(0.92)';
  toast.textContent = message;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0) scale(1)';
  }, 10);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-15px) scale(0.95)';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 2500);
}

/**
 * Convert time string "HH:MM" to integer minutes of the day.
 * @param {string} timeStr 
 * @returns {number}
 */
export function parseMins(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Format total minutes back into standard clock coordinates "HH:MM".
 * @param {number} minutes 
 * @returns {string}
 */
export function formatTime(minutes) {
  const h = Math.floor((minutes % (24 * 60)) / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Finds the slot containing the current local system clock time, accommodating wraps.
 * @param {Array} slots 
 * @returns {number} matching slot index or -1
 */
export function getLiveSlotIndex(slots) {
  if (!slots) return -1;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let matchedIndex = -1;
  slots.forEach((slot, index) => {
    const [startH, startM] = slot.startTime.split(':').map(Number);
    const [endH, endM] = slot.endTime.split(':').map(Number);
    
    let startMin = startH * 60 + startM;
    let endMin = endH * 60 + endM;
    
    // Handle overnight slots
    if (endMin < startMin) {
      endMin += 24 * 60;
    }
    
    let checkMinutes = currentMinutes;
    // Offset early morning checks if the slot started before midnight
    if (checkMinutes < startMin && (checkMinutes + 24 * 60) <= endMin) {
      checkMinutes += 24 * 60;
    }
    
    if (checkMinutes >= startMin && checkMinutes < endMin) {
      matchedIndex = index;
    }
  });

  return matchedIndex;
}
