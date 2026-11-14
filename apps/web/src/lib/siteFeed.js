// siteFeed — the one API request the site makes for everything it shows.
//
// The API's /site route answers every link card and the projects listing in
// one response. Whichever page opens first asks for it during an idle moment
// (warmSite), and the answer is held here for the rest of the visit, so the
// links and projects pages render from memory instead of asking again.
//
// Every entry keeps the max-age its own route would have sent. A page that
// needs an entry asks with ensureCards(): entries still fresh cost nothing,
// entries already on their way are waited for, and only the rest go into one
// further request. Live data stays live: Spotify playback has a max-age of 0,
// so it is never served from here twice.
//
// Entries are also kept in localStorage for as long as that max-age lasts, so
// a reload or a return visit inside it renders at once and asks for nothing.
import { useSyncExternalStore } from 'react';
import { apiUrl } from './api.js';
import { storage } from './storage.js';

// Long enough for a cold API, short enough that a card with a source of its own
// (GitHub, GitLab, Discord, the projects listing) is not kept waiting on a dead one.
const TIMEOUT_MS = 8000;

// Links config key -> the batch entries that card reads. A card absent from
// links.json is never requested.
const CARD_KEYS = {
  discord: ['discord'],
  telegram: ['telegram'],
  x: ['x'],
  github: ['github', 'githubContributions'],
  gitlab: ['gitlab', 'gitlabContributions'],
  linkedin: ['linkedin'],
  steam: ['steam'],
};
// Cards that can ask their provider themselves. Without an `apiEndpoint` in
// links.json they do exactly that and the API is never asked for them.
const DIRECT_CAPABLE = new Set(['github', 'gitlab']);

/** The batch entries the configured link cards read. */
export function cardKeys(config, { live = true } = {}) {
  const keys = Object.entries(CARD_KEYS).flatMap(([key, cards]) => {
    if (!config?.[key]) return [];
    if (DIRECT_CAPABLE.has(key) && !config[key].apiEndpoint) return [];
    return cards;
  });
  // The simple Spotify card has no API endpoint and so nothing to seed.
  if (live && config?.spotify?.userId && config.spotify.apiEndpoint) keys.push('spotify');
  return keys;
}

const PENDING = Object.freeze({ status: 'pending', generation: 0 });
// key -> the seed a consumer reads: { status, generation, data?, receivedAt?, maxAgeMs? }
const entries = new Map();
const inFlight = new Set();
const listeners = new Set();

const settle = (key, entry) => {
  const generation = (entries.get(key)?.generation ?? 0) + 1;
  entries.set(key, { ...entry, generation });
};
const notify = () => listeners.forEach((listener) => listener());

// Bump the suffix when the shape of a stored entry changes.
const STORE_KEY = 'site_feed_v1';
const storable = (entry, now) =>
  entry?.status === 'ready' &&
  entry.data != null &&
  typeof entry.receivedAt === 'number' &&
  typeof entry.maxAgeMs === 'number' &&
  // A clock set back since the entry was stored would keep it alive too long.
  entry.receivedAt <= now &&
  now - entry.receivedAt < entry.maxAgeMs;

let restored = false;
/** Once per visit, before the first read: take up what the last visit left. */
function restore() {
  if (restored || typeof window === 'undefined') return;
  restored = true;
  try {
    const now = Date.now();
    for (const [key, entry] of Object.entries(JSON.parse(storage.get(STORE_KEY) || '{}'))) {
      if (entries.has(key) || !storable(entry, now)) continue;
      const { data, receivedAt, maxAgeMs } = entry;
      settle(key, { status: 'ready', data, receivedAt, maxAgeMs });
    }
  } catch {
    // Unreadable: the page asks the API as if nothing had been stored.
  }
}

function persist() {
  const now = Date.now();
  const kept = {};
  for (const [key, { data, receivedAt, maxAgeMs, ...entry }] of entries) {
    if (storable({ ...entry, data, receivedAt, maxAgeMs }, now))
      kept[key] = { status: 'ready', data, receivedAt, maxAgeMs };
  }
  storage.set(STORE_KEY, JSON.stringify(kept));
}

// An entry the API just had nothing for is not asked for again straight away:
// its consumer has already fallen back, and a second batch would only repeat
// the failure.
const MISSING_HOLD_MS = 60 * 1000;
// When a batch last found the API itself unreachable; 0 while it answers.
let unreachableAt = 0;
const fresh = (key) => {
  const entry = entries.get(key);
  if (entry?.status === 'missing') return Date.now() - entry.receivedAt < MISSING_HOLD_MS;
  return entry?.status === 'ready' && Date.now() - entry.receivedAt < entry.maxAgeMs;
};

async function request(keys) {
  keys.forEach((key) => inFlight.add(key));
  // Deferred: a page may ask during its render, and subscribers must not be
  // told mid-render. Their next read already sees the entries as pending.
  queueMicrotask(notify);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let cards = null;
  // The API itself did not answer (offline, timed out, a 5xx), as opposed to
  // answering without one card. Consumers skip their own request to it and go
  // straight to whatever else they have.
  let unreachable = false;
  try {
    const response = await fetch(apiUrl(`/site?include=${encodeURIComponent(keys.join(','))}`), {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (response.ok) cards = (await response.json())?.cards || null;
    else unreachable = response.status >= 500;
  } catch {
    // A failed batch is not an error a page shows: each consumer falls back
    // to its own source or its own failure state.
    unreachable = true;
  } finally {
    clearTimeout(timeout);
  }
  const receivedAt = Date.now();
  unreachableAt = unreachable ? receivedAt : 0;
  for (const key of keys) {
    inFlight.delete(key);
    const card = cards?.[key];
    settle(
      key,
      !card || card.error || card.data == null
        ? { status: 'missing', receivedAt, unreachable }
        : { status: 'ready', data: card.data, receivedAt, maxAgeMs: (card.maxAge || 0) * 1000 },
    );
  }
  persist();
  notify();
}

/**
 * Make sure each entry is fresh or on its way. `force` asks again even for a
 * fresh entry (a retry button).
 */
export function ensureCards(keys, { force = false } = {}) {
  if (typeof window === 'undefined') return;
  restore();
  const wanted = keys.filter((key) => !inFlight.has(key) && (force || !fresh(key)));
  if (!wanted.length) return;
  // The API did not answer a moment ago: do not spend another timeout on it.
  // Every consumer already knows how to carry on without its entry.
  if (!force && Date.now() - unreachableAt < MISSING_HOLD_MS) {
    const receivedAt = Date.now();
    for (const key of wanted) settle(key, { status: 'missing', receivedAt, unreachable: true });
    queueMicrotask(notify);
    return;
  }
  request(wanted);
}

/**
 * One entry as a seed, in the shape usePolledJSON expects: `pending` while a
 * request that covers it is in flight, `ready` with its data and age, or
 * `missing` when the batch had nothing usable for it.
 */
export function cardSeed(key) {
  restore();
  if (inFlight.has(key)) {
    const generation = entries.get(key)?.generation ?? 0;
    return generation ? pendingSeed(key, generation) : PENDING;
  }
  return entries.get(key) ?? MISSING;
}

const MISSING = Object.freeze({ status: 'missing', generation: 0 });
// useSyncExternalStore needs the same object back until something changes.
const pendings = new Map();
function pendingSeed(key, generation) {
  const known = pendings.get(key);
  if (known?.generation === generation) return known;
  const seed = { status: 'pending', generation };
  pendings.set(key, seed);
  return seed;
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Subscribe a component to one entry. Prerendered HTML never has one. */
export function useSiteCard(key) {
  return useSyncExternalStore(
    subscribe,
    () => cardSeed(key),
    () => PENDING,
  );
}

const idle = (task) =>
  typeof requestIdleCallback === 'function'
    ? requestIdleCallback(task, { timeout: 3000 })
    : setTimeout(task, 1200);

// The page's own images and fonts come first: nothing is prefetched until the
// browser has finished loading them, or has taken this long over it.
const LOAD_WAIT_MS = 4000;
function afterLoad(task) {
  if (document.readyState === 'complete') return task();
  let ran = false;
  const run = () => {
    if (ran) return;
    ran = true;
    clearTimeout(timer);
    removeEventListener('load', run);
    task();
  };
  const timer = setTimeout(run, LOAD_WAIT_MS);
  addEventListener('load', run);
}

let warmed = false;
/**
 * Once per visit, after the first page has loaded: ask the API for everything
 * the other pages show, and fetch the content and code they open with, so
 * moving between pages waits on nothing. Skipped for visitors who asked their
 * browser to save data.
 */
export function warmSite({ content, preload }) {
  if (warmed || typeof window === 'undefined') return;
  warmed = true;
  if (navigator.connection?.saveData) return;
  afterLoad(() =>
    idle(() => {
      content
        .getLinks()
        // Spotify playback is only worth asking for on the page that shows it.
        .then((config) => ensureCards([...cardKeys(config, { live: false }), 'projects']))
        .catch(() => {});
      for (const load of [content.getBlogIndex, content.getProjects, content.getResume])
        load().catch(() => {});
      idle(preload);
    }),
  );
}
