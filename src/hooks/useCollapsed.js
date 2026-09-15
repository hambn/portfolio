import { useEffect, useState } from 'react';
import { storage } from '../lib/storage.js';

/** Collapse state persisted under a localStorage key. */
export function useCollapsed(storageKey) {
  const [collapsed, setCollapsed] = useState(() => storage.get(storageKey) === '1');
  useEffect(() => {
    storage.set(storageKey, collapsed ? '1' : '0');
  }, [storageKey, collapsed]);
  const toggle = () => setCollapsed((prev) => !prev);
  return [collapsed, toggle];
}
