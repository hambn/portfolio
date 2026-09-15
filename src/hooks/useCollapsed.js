import { useState } from 'react';

/** Collapse state persisted under a localStorage key. */
export function useCollapsed(storageKey) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
  });
  const toggle = () => setCollapsed(prev => {
    const next = !prev;
    try { localStorage.setItem(storageKey, next ? '1' : '0'); } catch {}
    return next;
  });
  return [collapsed, toggle];
}
