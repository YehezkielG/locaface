export type PopupType = 'success' | 'error' | 'warning' | 'info';

export interface PopupPayload {
  title?: string;
  message: string;
  type?: PopupType;
  durationMs?: number;
}

type PopupListener = (payload: PopupPayload) => void;

const listeners = new Set<PopupListener>();

export function subscribePopup(listener: PopupListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function showPopup(payload: PopupPayload) {
  listeners.forEach((listener) => listener(payload));
}
