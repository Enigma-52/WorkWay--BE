const COLORS = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

const LEVELS = {
  INFO: { label: "INFO", color: COLORS.blue },
  WARN: { label: "WARN", color: COLORS.yellow },
  ERROR: { label: "ERROR", color: COLORS.red },
};

function formatISTTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function formatMeta(meta) {
  if (!meta || Object.keys(meta).length === 0) return "";
  const metaString = Object.entries(meta)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  return `  →  ${metaString}`;
}

function log(level, message, meta) {
  const time = formatISTTime();
  const { label, color } = LEVELS[level];

  console.log(
    `${COLORS.gray}[${time} IST]${COLORS.reset}  ` +
    `${color}${label.padEnd(5)}${COLORS.reset}  ` +
    `${message}` +
    formatMeta(meta)
  );
}

export const logger = {
  info(message, meta = {}) {
    log("INFO", message, meta);
  },
  warn(message, meta = {}) {
    log("WARN", message, meta);
  },
  error(message, meta = {}) {
    log("ERROR", message, meta);
  },
};
