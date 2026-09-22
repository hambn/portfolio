import type { Services } from './contracts.js';
import { refreshLinkedIn } from './providers/linkedin.js';
import { refreshX } from './providers/x.js';
import { refreshTelegram } from './providers/telegram.js';

export async function refresh(services: Services) {
  const results = await Promise.allSettled([
    refreshTelegram(services),
    refreshX(services),
    refreshLinkedIn(services),
  ]);
  const errors = results
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason);
  if (errors.length) throw new AggregateError(errors, 'Profile refresh failed');
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
