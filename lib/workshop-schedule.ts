const IST_TIME_ZONE = "Asia/Kolkata";
const SESSION_WEEKDAY = 6;
const SESSION_HOUR = 19;
const SESSION_MINUTE = 0;
const SESSION_DURATION_MINUTES = 120;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type WorkshopSchedule = {
  startsAtIso: string;
  dateLabel: string;
  timeLabel: string;
  durationLabel: string;
  slotLabel: string;
};

type IstParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  weekday: "short"
});

const dateLabelFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});

const timeLabelFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZoneName: "short"
});

const weekdayMap: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

export function getNextWorkshopSchedule(now = new Date()): WorkshopSchedule {
  const nowParts = getIstParts(now);
  const todaySession = getIstDateAsUtcDate(
    nowParts.year,
    nowParts.month,
    nowParts.day,
    SESSION_HOUR,
    SESSION_MINUTE
  );
  let daysUntilSession = (SESSION_WEEKDAY - nowParts.weekday + 7) % 7;

  if (daysUntilSession === 0 && now.getTime() >= todaySession.getTime()) {
    daysUntilSession = 7;
  }

  const sessionBase = getIstDateAsUtcDate(
    nowParts.year,
    nowParts.month,
    nowParts.day,
    SESSION_HOUR,
    SESSION_MINUTE
  );
  const startsAt = new Date(sessionBase.getTime() + daysUntilSession * MS_PER_DAY);
  const dateLabel = dateLabelFormatter.format(startsAt);
  const timeLabel = timeLabelFormatter.format(startsAt).replace("GMT+5:30", "IST");

  return {
    startsAtIso: startsAt.toISOString(),
    dateLabel,
    timeLabel,
    durationLabel: "2 hours",
    slotLabel: `${dateLabel}, ${timeLabel}`
  };
}

function getIstParts(date: Date): IstParts {
  const values = Object.fromEntries(
    dateTimeFormatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    weekday: weekdayMap[values.weekday ?? "Sat"] ?? SESSION_WEEKDAY
  };
}

function getIstDateAsUtcDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
) {
  return new Date(Date.UTC(year, month - 1, day, hour - 5, minute - 30));
}
