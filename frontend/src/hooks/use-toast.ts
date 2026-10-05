import { useCallback, useSyncExternalStore } from 'react';

export interface ToastOptions { title?: string; description?: string; variant?: string; }
export interface ToastNotice extends ToastOptions { id: number; }

let nextId = 0;
let notices: ToastNotice[] = [];
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeToToasts(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToasts() {
  return notices;
}

export function dismissToast(id: number) {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  notices = notices.filter((notice) => notice.id !== id);
  notify();
}

function publishToast(options: ToastOptions) {
  const id = ++nextId;
  notices = [...notices.slice(-2), { ...options, id }];
  timers.set(id, setTimeout(() => dismissToast(id), 4500));
  notify();
}

export function useToast() {
  const toast = useCallback((options: ToastOptions) => publishToast(options), []);

  return {
    toast,
  };
}

export function useToasts() {
  return useSyncExternalStore(subscribeToToasts, getToasts, getToasts);
}
