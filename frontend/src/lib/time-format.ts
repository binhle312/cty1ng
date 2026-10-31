// Times on pages (design/components/time-format.md §1, ui-rules T1, T3): under one day "5 min
// ago" or "3 h ago", otherwise the local time in ISO order, "2026-10-21 14:05", on a 24-hour
// clock. The full time with its UTC offset goes in a tooltip. `now` is passed in so tests can
// fix it.
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const two = (n: number) => String(n).padStart(2, "0");

export function formatTime(iso: string, now: Date): string {
  const time = new Date(iso);
  const age = now.getTime() - time.getTime();
  if (age < DAY) {
    if (age < MINUTE) return "just now";
    if (age < HOUR) return `${String(Math.floor(age / MINUTE))} min ago`;
    return `${String(Math.floor(age / HOUR))} h ago`;
  }
  return `${localDate(time)} ${two(time.getHours())}:${two(time.getMinutes())}`;
}

// "2026-10-21 14:05:09 +07:00"
export function formatFullTime(iso: string): string {
  const time = new Date(iso);
  const offset = -time.getTimezoneOffset();
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  return `${localDate(time)} ${two(time.getHours())}:${two(time.getMinutes())}:${two(time.getSeconds())} ${sign}${two(Math.floor(abs / 60))}:${two(abs % 60)}`;
}

function localDate(time: Date): string {
  return `${String(time.getFullYear())}-${two(time.getMonth() + 1)}-${two(time.getDate())}`;
}
