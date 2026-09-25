// Last Jarvis call, remembered in this browser. The server cannot keep a
// durable "last success" without a new database table, and a green "active"
// dot was only checking that an API key exists.

const SUCCESS = "mirofish.jarvis.lastSuccessAt";
const ERROR_AT = "mirofish.jarvis.lastErrorAt";
const ERROR = "mirofish.jarvis.lastError";

export const JARVIS_STATUS_EVENT = "mirofish-jarvis-status";

export interface JarvisClientStatus {
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
}

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(JARVIS_STATUS_EVENT));
}

export function recordJarvisSuccess() {
  if (typeof window === "undefined") return;
  localStorage.setItem(SUCCESS, new Date().toISOString());
  emit();
}

export function recordJarvisFailure(message: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ERROR_AT, new Date().toISOString());
  localStorage.setItem(ERROR, message.slice(0, 180));
  emit();
}

export function readJarvisClientStatus(): JarvisClientStatus {
  if (typeof window === "undefined") {
    return { lastSuccessAt: null, lastErrorAt: null, lastError: null };
  }
  return {
    lastSuccessAt: localStorage.getItem(SUCCESS),
    lastErrorAt: localStorage.getItem(ERROR_AT),
    lastError: localStorage.getItem(ERROR),
  };
}
