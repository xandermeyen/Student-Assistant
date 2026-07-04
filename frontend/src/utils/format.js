// Formatting and small browser helpers shared across screens.

export function timeAgo(dateStr) {
  // SQLite CURRENT_TIMESTAMP is UTC without a Z suffix; add it so JS parses as UTC
  const normalized = dateStr.endsWith('Z') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const diff = Math.floor((Date.now() - new Date(normalized)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// The last 7 days as { dateStr: YYYY-MM-DD, label: weekday initial }, oldest first
export function getLastSevenDays() {
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { dateStr: d.toLocaleDateString('en-CA'), label: labels[d.getDay()] };
  });
}

// Mastery %: easiness factor 1.3 = 0%, 2.5 = 100%. Null when never reviewed.
export function getMastery(topic) {
  if (!topic.reviewed_count) return null;
  return Math.round(Math.min(100, Math.max(0, ((topic.avg_ef - 1.3) / (2.5 - 1.3)) * 100)));
}

// Whole days from today until dateStr. Negative when the date has passed.
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

export function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
