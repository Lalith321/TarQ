export type AppLogSource = 'frontend' | 'backend';
export type AppLogLevel = 'log' | 'info' | 'warn' | 'error';

export interface AppLogEntry {
  id: number;
  time: string;
  source: AppLogSource;
  level: AppLogLevel;
  message: string;
}

const MAX_LOGS = 1000;
const listeners = new Set<(entries: AppLogEntry[]) => void>();
let entries: AppLogEntry[] = [];
let nextId = 1;
let captureInstalled = false;

function publish(source: AppLogSource, level: AppLogLevel, message: string) {
  const entry: AppLogEntry = {
    id: nextId++,
    time: new Date().toLocaleTimeString(),
    source,
    level,
    message,
  };
  entries = [...entries.slice(-(MAX_LOGS - 1)), entry];
  listeners.forEach((listener) => listener(entries));
}

function formatValue(value: unknown): string {
  if (value instanceof Error) return value.stack ?? value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export function subscribeAppLogs(listener: (entries: AppLogEntry[]) => void) {
  listeners.add(listener);
  listener(entries);
  return () => listeners.delete(listener);
}

export function clearAppLogs() {
  entries = [];
  listeners.forEach((listener) => listener(entries));
}

export function recordBackendLog(level: string, logger: string, message: string) {
  const normalizedLevel: AppLogLevel = level.toLowerCase() === 'error' || level.toLowerCase() === 'critical'
    ? 'error'
    : level.toLowerCase() === 'warning' || level.toLowerCase() === 'warn'
      ? 'warn'
      : level.toLowerCase() === 'debug'
        ? 'log'
        : 'info';
  publish('backend', normalizedLevel, logger ? `${logger}: ${message}` : message);
}

export function installBrowserLogCapture() {
  if (captureInstalled) return;
  captureInstalled = true;

  (['log', 'info', 'warn', 'error'] as const).forEach((level) => {
    const original = console[level].bind(console);
    console[level] = (...values: unknown[]) => {
      original(...values);
      publish('frontend', level, values.map(formatValue).join(' '));
    };
  });

  window.addEventListener('error', (event) => {
    publish('frontend', 'error', `${event.message} (${event.filename}:${event.lineno})`);
  });
  window.addEventListener('unhandledrejection', (event) => {
    publish('frontend', 'error', `Unhandled promise rejection: ${formatValue(event.reason)}`);
  });
}