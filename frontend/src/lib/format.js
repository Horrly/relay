// Pure helpers for rendering the chat — kept framework-free so they're easy to unit test.

const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Consecutive messages from the same author within 5 minutes render as one block.
export function startsNewGroup(prev, curr) {
  if (!prev) return true;
  if (prev.author !== curr.author) return true;
  return new Date(curr.created_at) - new Date(prev.created_at) > GROUP_WINDOW_MS;
}

export function dayKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayLabel(iso, now = new Date()) {
  const key = dayKey(iso);
  if (key === dayKey(now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (key === dayKey(yesterday)) return "Yesterday";
  return new Date(iso).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export function typingText(users) {
  if (users.length === 0) return "";
  if (users.length === 1) return `${users[0]} is typing…`;
  if (users.length === 2) return `${users[0]} and ${users[1]} are typing…`;
  return "Several people are typing…";
}

export function initials(name) {
  return name.slice(0, 2).toUpperCase();
}

// Stable colour per username for avatars.
const AVATAR_COLORS = [
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-indigo-500",
];

export function avatarColor(name) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
