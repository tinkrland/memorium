// timezone awareness service
// parses colloquial timezone references and converts to proper IANA timezone strings

const TZ_ALIASES: Record<string, string> = {
  // us
  "est": "America/New_York",
  "eastern": "America/New_York",
  "et": "America/New_York",
  "edt": "America/New_York",
  "cst": "America/Chicago",
  "central": "America/Chicago",
  "ct": "America/Chicago",
  "cdt": "America/Chicago",
  "mst": "America/Denver",
  "mountain": "America/Denver",
  "mt": "America/Denver",
  "mdt": "America/Denver",
  "pst": "America/Los_Angeles",
  "pacific": "America/Los_Angeles",
  "pt": "America/Los_Angeles",
  "pdt": "America/Los_Angeles",
  "akst": "America/Anchorage",
  "akdt": "America/Anchorage",
  "alaska": "America/Anchorage",
  "hst": "Pacific/Honolulu",
  "hawaii": "Pacific/Honolulu",
  "ht": "Pacific/Honolulu",

  // india
  "ist": "Asia/Kolkata",
  "india": "Asia/Kolkata",
  "indian": "Asia/Kolkata",
  "indian standard time": "Asia/Kolkata",

  // uk
  "gmt": "Europe/London",
  "utc": "UTC",
  "bst": "Europe/London",
  "london": "Europe/London",
  "uk": "Europe/London",
  "british": "Europe/London",

  // europe
  "cet": "Europe/Paris",
  "central european": "Europe/Paris",
  "cest": "Europe/Paris",
  "eet": "Europe/Athens",
  "eest": "Europe/Athens",
  "berlin": "Europe/Berlin",
  "paris": "Europe/Paris",
  "amsterdam": "Europe/Amsterdam",
  "madrid": "Europe/Madrid",
  "rome": "Europe/Rome",
  "athens": "Europe/Athens",

  // asia
  "jst": "Asia/Tokyo",
  "japan": "Asia/Tokyo",
  "tokyo": "Asia/Tokyo",
  "kst": "Asia/Seoul",
  "korea": "Asia/Seoul",
  "seoul": "Asia/Seoul",
  "sgt": "Asia/Singapore",
  "singapore": "Asia/Singapore",
  "hkt": "Asia/Hong_Kong",
  "hong kong": "Asia/Hong_Kong",
  "uae": "Asia/Dubai",
  "dubai": "Asia/Dubai",
  "gst": "Asia/Dubai",

  // australia
  "aest": "Australia/Sydney",
  "aedt": "Australia/Sydney",
  "sydney": "Australia/Sydney",
  "acst": "Australia/Adelaide",
  "acdt": "Australia/Adelaide",
  "awst": "Australia/Perth",
  "perth": "Australia/Perth",

  // misc
  "nzst": "Pacific/Auckland",
  "nz": "Pacific/Auckland",
  "new zealand": "Pacific/Auckland",
};

const CITY_TIMEZONES: Record<string, string> = {
  "new york": "America/New_York",
  "nyc": "America/New_York",
  "los angeles": "America/Los_Angeles",
  "la": "America/Los_Angeles",
  "san francisco": "America/Los_Angeles",
  "sf": "America/Los_Angeles",
  "chicago": "America/Chicago",
  "denver": "America/Denver",
  "seattle": "America/Los_Angeles",
  "austin": "America/Chicago",
  "dallas": "America/Chicago",
  "houston": "America/Chicago",
  "boston": "America/New_York",
  "washington": "America/New_York",
  "dc": "America/New_York",
  "miami": "America/New_York",
  "atlanta": "America/New_York",
  "phoenix": "America/Phoenix",
  "portland": "America/Los_Angeles",
  "mumbai": "Asia/Kolkata",
  "delhi": "Asia/Kolkata",
  "bangalore": "Asia/Kolkata",
  "london": "Europe/London",
  "berlin": "Europe/Berlin",
  "paris": "Europe/Paris",
  "tokyo": "Asia/Tokyo",
  "singapore": "Asia/Singapore",
  "sydney": "Australia/Sydney",
  "dubai": "Asia/Dubai",
  "toronto": "America/Toronto",
  "vancouver": "America/Vancouver",
};

// extract timezone from colloquial text
export function extractTimezone(text: string): string | null {
  const lower = text.toLowerCase().trim();

  // check direct aliases
  if (TZ_ALIASES[lower]) return TZ_ALIASES[lower];

  // check for "in <timezone>" pattern
  const inMatch = lower.match(/(?:in|at)\s+([a-z\s]+?)(?:\s+(?:time|timezone|tz))?(?:[\s,\.]|$)/);
  if (inMatch) {
    const candidate = inMatch[1].trim();
    if (TZ_ALIASES[candidate]) return TZ_ALIASES[candidate];
    if (CITY_TIMEZONES[candidate]) return CITY_TIMEZONES[candidate];
  }

  // check city names
  for (const [city, tz] of Object.entries(CITY_TIMEZONES)) {
    if (lower.includes(city)) return tz;
  }

  // check all aliases
  for (const [alias, tz] of Object.entries(TZ_ALIASES)) {
    if (lower.includes(alias)) return tz;
  }

  return null;
}

// convert a time in a source timezone to UTC
export function convertToUTC(timeStr: string, sourceTz: string): string {
  try {
    // try parsing with the timezone
    const date = new Date(timeStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }

    // if its a time only (e.g. "3:00 PM"), assume today
    const today = new Date().toISOString().split("T")[0];
    const fullStr = `${today} ${timeStr}`;
    const dateWithTz = new Date(fullStr);
    return dateWithTz.toISOString();
  } catch {
    return timeStr;
  }
}

// parse a colloquial time reference
// "tomorrow at 3pm est" -> ISO 8601
// "friday 9am pacific" -> ISO 8601
// "in 2 hours" -> ISO 8601
export function parseColloquialTime(text: string): { time: string; timezone: string | null } {
  const lower = text.toLowerCase();
  const now = new Date();

  // extract timezone first
  const tz = extractTimezone(text);

  // "in X hours/minutes"
  const relativeMatch = lower.match(/in\s+(\d+)\s+(hour|minute|hr|min)/);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2];
    const ms = unit.startsWith("hour") || unit.startsWith("hr") ? amount * 60 * 60 * 1000 : amount * 60 * 1000;
    return { time: new Date(now.getTime() + ms).toISOString(), timezone: tz };
  }

  // "tomorrow at X"
  const tomorrowMatch = lower.match(/tomorrow.*?(\d{1,2})[:\s]?(\d{2})?\s*(am|pm)?/);
  if (tomorrowMatch) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const hours = parseInt(tomorrowMatch[1]);
    const minutes = tomorrowMatch[2] ? parseInt(tomorrowMatch[2]) : 0;
    const ampm = tomorrowMatch[3];
    const finalHours = ampm === "pm" && hours < 12 ? hours + 12 : ampm === "am" && hours === 12 ? 0 : hours;
    tomorrow.setHours(finalHours, minutes, 0, 0);
    return { time: tomorrow.toISOString(), timezone: tz };
  }

  // "monday", "tuesday", etc.
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let i = 0; i < days.length; i++) {
    if (lower.includes(days[i])) {
      const targetDay = i;
      const currentDay = now.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7; // next week

      const target = new Date(now);
      target.setDate(target.getDate() + diff);

      // try to extract time
      const timeMatch = lower.match(/(\d{1,2})[:\s]?(\d{2})?\s*(am|pm)?/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const ampm = timeMatch[3];
        const finalHours = ampm === "pm" && hours < 12 ? hours + 12 : ampm === "am" && hours === 12 ? 0 : hours;
        target.setHours(finalHours, minutes, 0, 0);
      }

      return { time: target.toISOString(), timezone: tz };
    }
  }

  // default: try to parse as-is
  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return { time: parsed.toISOString(), timezone: tz };
  }

  return { time: now.toISOString(), timezone: tz };
}
