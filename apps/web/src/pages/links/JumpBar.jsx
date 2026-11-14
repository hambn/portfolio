import React, { useCallback, useRef, useSyncExternalStore } from 'react';
import { readCollapsed, subscribeCollapsed, writeCollapsed } from '../../lib/cardState.js';
import Icon from '../../components/Icon.jsx';
import { BRAND_ICON } from './brandIcons.js';
import { useIsland } from './useIsland.js';

const collapsedKey = (id) => `${id}_card_collapsed`;

// The ids of the collapsed cards as one string, so the jump bar re-renders the
// moment any card opens or shuts, wherever the click came from.
function useCollapsedIds(cards) {
  const subscribe = useCallback(
    (notify) => {
      const stops = cards.map((card) => subscribeCollapsed(collapsedKey(card.id), notify));
      return () => stops.forEach((stop) => stop());
    },
    [cards],
  );
  return useSyncExternalStore(
    subscribe,
    () =>
      cards
        .filter((card) => readCollapsed(collapsedKey(card.id)))
        .map((card) => card.id)
        .join(' '),
    () => '',
  );
}

// A touch longer than the body's open transition in cards.css.
const OPEN_MS = 440;

// Whether the card already sits where a jump would put it: near the top of the
// view, or as far up as the end of the page lets it go.
function inPlace(el) {
  const top = el.getBoundingClientRect().top;
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const page = document.documentElement;
  const atEnd = window.innerHeight + window.scrollY >= page.scrollHeight - 2;
  return top >= margin - 12 && (top < window.innerHeight * 0.6 || atEnd);
}
// One chip per card. A chip brings its card into view and opens it; pressed
// again while that card is in place, it collapses the card without moving.
export default function JumpBar({ cards }) {
  const barRef = useRef(null);
  const islandRef = useRef(null);
  useIsland(barRef, islandRef);
  const collapsed = useCollapsedIds(cards).split(' ').filter(Boolean);
  const allCollapsed = collapsed.length === cards.length;
  const jump = (id) => {
    const el = document.getElementById(`card-${id}`);
    if (!el) return;
    const key = collapsedKey(id);
    const opening = readCollapsed(key);
    if (opening) writeCollapsed(key, false);
    else if (inPlace(el)) return writeCollapsed(key, true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const go = () => el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    go();
    // A card near the end of the page has nowhere to scroll to until it has
    // opened, so aim again once its body has finished growing (cards.css).
    if (opening) setTimeout(go, OPEN_MS);
  };
  const setAll = () => {
    for (const card of cards) writeCollapsed(collapsedKey(card.id), !allCollapsed);
  };
  return (
    <nav className="links-jump" ref={barRef} aria-label="link cards">
      <div className="links-jump-island" ref={islandRef}>
        <div className="links-jump-list">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              className="links-jump-item"
              data-card={card.id}
              aria-label={card.label}
              title={card.label}
              aria-expanded={!collapsed.includes(card.id)}
              aria-controls={`card-${card.id}`}
              onClick={() => jump(card.id)}
            >
              <svg className="links-jump-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d={BRAND_ICON[card.id]} />
              </svg>
              <span className="links-jump-label">{card.label}</span>
            </button>
          ))}
          <button
            type="button"
            className="links-jump-item links-jump-all"
            title={allCollapsed ? 'expand all' : 'collapse all'}
            onClick={setAll}
          >
            <Icon name={allCollapsed ? 'expand' : 'collapse'} />
            <span className="links-jump-label">{allCollapsed ? 'expand' : 'collapse'}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
