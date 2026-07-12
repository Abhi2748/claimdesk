export interface DateOnlyParts {
  year: number;
  month: number;
  day: number;
}

/** Parse a YYYY-MM-DD string into calendar date parts (month is 1–12). */
export function parseDateOnly(dateStr: string): DateOnlyParts {
  const datePart = dateStr.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) {
    throw new Error(`Invalid date-only string: ${dateStr}`);
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

/** Format a YYYY-MM-DD string without timezone shifting. */
export function formatDateOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const { year, month, day } = parseDateOnly(dateStr);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateOnlyParts(parts: DateOnlyParts): string {
  return new Date(parts.year, parts.month - 1, parts.day).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );
}

export function getTodayDateOnly(): DateOnlyParts {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

export function addMonthsToDateOnly(
  dateStr: string,
  months: number
): DateOnlyParts {
  const { year, month, day } = parseDateOnly(dateStr);
  const date = new Date(year, month - 1, day);
  date.setMonth(date.getMonth() + months);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetweenDateOnly(
  from: DateOnlyParts,
  to: DateOnlyParts
): number {
  const fromUtc = Date.UTC(from.year, from.month - 1, from.day);
  const toUtc = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toUtc - fromUtc) / (1000 * 60 * 60 * 24));
}
