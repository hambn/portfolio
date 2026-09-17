import type { Services } from './contracts.js';
import { refreshTelegram } from './providers/telegram.js';

export async function refresh(services: Services) {
  await refreshTelegram(services);
}

// One instance per Node process. Workers use their platform's scheduled handler.
export function refreshJob(services: Services) {
  let pending: Promise<void> | undefined;
  return () => {
    pending ??= refresh(services).finally(() => {
      pending = undefined;
    });
    return pending;
  };
}
