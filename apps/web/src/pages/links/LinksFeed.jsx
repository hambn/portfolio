// LinksFeed — the links page's share of the one site-wide API request.
//
// lib/siteFeed.js holds what the API's /site route answered. Mounting the page
// asks for whichever of its cards are not already fresh there (none, when the
// visitor came from another page a moment ago), and each card reads its slice
// as a seed, so it renders without a request of its own while that slice is
// inside the max-age its own route would have sent. Cards stay in charge of
// their live data: Spotify keeps polling playback, Steam and Discord keep
// their intervals, and a card expanded after its seed went stale re-fetches
// its own endpoint.
import { useMemo } from 'react';
import { cardKeys, ensureCards, useSiteCard } from '../../lib/siteFeed.js';

export function LinksFeed({ config, children }) {
  // The projects listing rides along, so a visitor who opens this page first
  // still makes one request for the whole site.
  const include = [...cardKeys(config), 'projects'].join(',');
  // During render, not in an effect: the cards' own effects run before this
  // component's would, and they must find their entry already on its way.
  useMemo(() => ensureCards(include.split(',')), [include]);
  return children;
}

/** Seed for one card; see cardSeed in lib/siteFeed.js. */
export const useCardFeed = useSiteCard;
