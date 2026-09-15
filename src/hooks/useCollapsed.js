import { useEffect, useState } from 'react';
import { storage } from '../lib/storage.js';

export function useCollapsed(storageKey) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(storage.get(storageKey) === '1');
  }, [storageKey]);
  const toggle = () => {
    const next = !collapsed;
    storage.set(storageKey, next ? '1' : '0');
    setCollapsed(next);
  };
  return [collapsed, toggle];
}
