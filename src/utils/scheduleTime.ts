/**
 * Scheduling time contract.
 *
 * `posts.scheduled_at` is an absolute instant, stored as `timestamptz`. The
 * publish worker compares it against `now()` in UTC, so every value written
 * from the UI must be a real UTC instant — never a bare local wall-clock
 * string.
 *
 * The bug this replaces: the Calendar built `` `${date}T${time}:00` `` with no
 * offset, which Postgres then interpreted in the *server's* timezone. A user
 * in UTC-5 picking 09:00 had the post stored as 09:00 server time, so the
 * calendar and the scheduler disagreed about when it was due.
 *
 * Convention used here: dates and times typed into the UI are the user's
 * local wall-clock. These helpers convert between that local representation
 * and the UTC instant stored in the database.
 */

/** Format a Date as `YYYY-MM-DD` in the browser's local timezone. */
export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Combine a local `YYYY-MM-DD` date and `HH:mm` time into a UTC ISO instant.
 * Returns null when the date is missing or unparseable.
 */
export function localWallClockToUtcIso(
  dateKey?: string | null,
  time?: string | null,
): string | null {
  if (!dateKey) return null;

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!dateMatch) return null;

  const [, year, month, day] = dateMatch;
  const timeMatch = /^(\d{1,2}):(\d{2})/.exec(time ?? "");
  const hours = timeMatch ? Number(timeMatch[1]) : 9;
  const minutes = timeMatch ? Number(timeMatch[2]) : 0;

  const local = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    hours,
    minutes,
    0,
    0,
  );

  if (Number.isNaN(local.getTime())) return null;
  return local.toISOString();
}

/**
 * Split a stored UTC instant back into the local date and time a user should
 * see in the pickers. Falls back to today's date when absent.
 */
export function utcIsoToLocalParts(raw?: string | null): { date: string; time: string } {
  if (!raw) return { date: toLocalDateKey(new Date()), time: "" };

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return { date: toLocalDateKey(new Date()), time: "" };

  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return { date: toLocalDateKey(parsed), time: `${hours}:${minutes}` };
}
