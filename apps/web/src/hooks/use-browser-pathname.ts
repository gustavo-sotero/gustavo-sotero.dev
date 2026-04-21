import { useSyncExternalStore } from 'react';

const LOCATION_CHANGE_EVENT = 'app:locationchange';

let historyPatched = false;

function ensureHistoryPatch() {
  if (historyPatched) return;

  historyPatched = true;

  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method];

    window.history[method] = function patchedHistoryMethod(...args) {
      const result = original.apply(window.history, args);
      window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
      return result;
    } as History[typeof method];
  }
}

function subscribe(callback: () => void): () => void {
  ensureHistoryPatch();

  const notify = () => callback();

  window.addEventListener('popstate', notify);
  window.addEventListener(LOCATION_CHANGE_EVENT, notify);

  return () => {
    window.removeEventListener('popstate', notify);
    window.removeEventListener(LOCATION_CHANGE_EVENT, notify);
  };
}

function getSnapshot(): string {
  return window.location.pathname;
}

function getServerSnapshot(): string {
  return '';
}

/**
 * SSR-safe pathname subscription that avoids Next's dynamic client pathname API.
 * Server render gets an empty pathname so the navbar shell can be prerendered,
 * then the active link state is refined after hydration and client navigation.
 */
export function useBrowserPathname(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
