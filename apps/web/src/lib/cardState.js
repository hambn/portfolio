// Shared collapsed-state store for the link cards.
//
// Every card persists its own `<prefix>_card_collapsed` key, but the value has
// to be readable outside the card too: Links.jsx gates the Discord WebSocket on
// whether the Discord card is expanded. A tiny store keeps one source of truth
// and lets useSyncExternalStore read it synchronously.
//
// Prerendered HTML is always expanded. index.html lists the cards collapsed on
// a previous visit in <html data-collapsed> before first paint and cards.css
// closes them, so a cold load does not open and then shut them; a toggle keeps
// that list in step with the store.
//
// Unset key === expanded: a first-time visitor sees every card open.
import { storage } from './storage.js';

const cache = new Map();
const listeners = new Map();

export function readCollapsed(key) {
  if (!cache.has(key)) cache.set(key, storage.get(key) === '1');
  return cache.get(key);
}

export function writeCollapsed(key, collapsed) {
  cache.set(key, collapsed);
  storage.set(key, collapsed ? '1' : '0');
  markCollapsed(key.replace(/_card_collapsed$/, ''), collapsed);
  listeners.get(key)?.forEach((notify) => notify());
}

export function subscribeCollapsed(key, notify) {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(notify);
  return () => {
    set.delete(notify);
    if (!set.size) listeners.delete(key);
  };
}

function markCollapsed(card, collapsed) {
  const root = document.documentElement;
  const cards = new Set((root.dataset.collapsed || '').split(' ').filter(Boolean));
  if (collapsed) cards.add(card);
  else cards.delete(card);
  root.dataset.collapsed = [...cards].join(' ');
}
