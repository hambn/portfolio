// LinksFeed — one API request for the whole links page.
//
// The API's /links route answers every card at once. This provider fetches it
// exactly once per visit and hands each card its slice as a seed, so a card
// renders without a request of its own while that slice is still inside the
// max-age its own route would have sent. Cards stay in charge of their live
// data: Spotify keeps polling playback, Steam and Discord keep their intervals,
// and a card expanded after its seed went stale re-fetches its own endpoint.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../../lib/api.js';

// Config key -> batch card key. Cards absent from links.json are never requested.
const CARD_KEYS = {
  discord: ['discord'],
  telegram: ['telegram'],
  x: ['x'],
  github: ['github', 'githubContributions'],
  gitlab: ['gitlab'],
  linkedin: ['linkedin'],
  steam: ['steam'],
};

function cardKeys(config) {
  const keys = Object.entries(CARD_KEYS).flatMap(([key, cards]) => (config?.[key] ? cards : []));
  // The simple Spotify card has no API endpoint and so nothing to seed.
  if (config?.spotify?.userId && config.spotify.apiEndpoint) keys.push('spotify');
  return keys;
}

// `pending` until the batch settles, so a card that mounted first waits for it
// instead of racing ahead with its own request.
const PENDING = { status: 'pending', generation: 0, cards: null, receivedAt: 0 };
const FeedContext = createContext(PENDING);

export function LinksFeed({ config, children }) {
  const include = cardKeys(config).join(',');
  const [feed, setFeed] = useState(PENDING);

  useEffect(() => {
    if (!include) {
      setFeed({ status: 'empty', generation: 1, cards: null, receivedAt: 0 });
      return undefined;
    }
    let alive = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const settle = (status, cards) => {
      if (alive) setFeed({ status, generation: 1, cards, receivedAt: Date.now() });
    };
    fetch(apiUrl(`/links?include=${encodeURIComponent(include)}`), {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`batch failed (${response.status})`);
        return response.json();
      })
      // A failed batch is not an error the page shows: every card can still
      // fall back to fetching its own endpoint.
      .then((body) => settle('ready', body?.cards || null))
      .catch(() => settle('error', null));
    return () => {
      alive = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [include]);

  return <FeedContext.Provider value={feed}>{children}</FeedContext.Provider>;
}

/**
 * Seed for one card, in the shape usePolledJSON expects. `pending` makes the
 * card wait; a missing or errored card yields null so it fetches for itself.
 */
export function useCardFeed(key) {
  const feed = useContext(FeedContext);
  return useMemo(() => {
    if (feed.status === 'pending') return { status: 'pending', generation: feed.generation };
    const card = feed.cards?.[key];
    if (!card || card.error || card.data == null)
      return { status: 'missing', generation: feed.generation };
    // receivedAt rather than a precomputed age: freshness is decided when the
    // card actually needs the data, which for a collapsed card can be much later.
    return {
      status: 'ready',
      generation: feed.generation,
      data: card.data,
      receivedAt: feed.receivedAt,
      maxAgeMs: (card.maxAge || 0) * 1000,
    };
  }, [feed, key]);
}
