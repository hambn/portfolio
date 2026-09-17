// Only the configured Discord user's subscription may pass through the relay.
export function presenceMessage(value: string, userId: string): string | null {
  if (value.length > 4096) return null;
  try {
    const message = JSON.parse(value);
    if (message.op === 3) return JSON.stringify({ op: 3 });
    if (message.op === 2 && userId)
      return JSON.stringify({ op: 2, d: { subscribe_to_id: userId } });
  } catch {
    /* Ignore malformed frames. */
  }
  return null;
}
