const IST_TIME_ZONE = "Asia/Kolkata";

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  if (typeof value === "string") {
    const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
    // If it's a naive ISO string, treat it as UTC to avoid local-time drift.
    const normalizedValue = hasTimezone ? value : `${value}Z`;
    return new Date(normalizedValue);
  }

  return new Date(value);
}

export function formatDateTimeIst(value) {
  const parsed = parseDateValue(value);
  if (!parsed || Number.isNaN(parsed.getTime())) return "—";
  return dateTimeFormatter.format(parsed);
}

export function formatDateIst(value) {
  const parsed = parseDateValue(value);
  if (!parsed || Number.isNaN(parsed.getTime())) return "—";
  return dateFormatter.format(parsed);
}