import { useCallback, useSyncExternalStore } from 'react';
import { readCollapsed, subscribeCollapsed, writeCollapsed } from '../lib/cardState.js';

/** Read a card's collapsed flag without owning the toggle. */
export function useCardCollapsed(storageKey) {
  return useSyncExternalStore(
    useCallback((notify) => subscribeCollapsed(storageKey, notify), [storageKey]),
    useCallback(() => readCollapsed(storageKey), [storageKey]),
    // Prerendered HTML is always the expanded card; React re-renders with the
    // stored value right after hydration.
    () => false,
  );
}

export function useCollapsed(storageKey) {
  const collapsed = useCardCollapsed(storageKey);
  const toggle = useCallback(
    () => writeCollapsed(storageKey, !readCollapsed(storageKey)),
    [storageKey],
  );
  return [collapsed, toggle];
}
