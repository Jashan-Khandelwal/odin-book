const UNITS = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

// Intl.RelativeTimeFormat is built into the browser. You give it a number and a unit, and it writes the English:

// js
// rtf.format(-3, "hour")   // "3 hours ago"
// rtf.format(-1, "day")    // "yesterday"
// rtf.format(-1, "week")   // "last week"
// rtf.format(2, "day")     // "in 2 days"
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function timeAgo(iso) {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return "just now";
  for (const [unit, size] of UNITS) {
    if (seconds >= size) return rtf.format(-Math.floor(seconds / size), unit);
  }
  return "just now";
}
