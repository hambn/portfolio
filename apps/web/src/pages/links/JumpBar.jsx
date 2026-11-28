import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
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
const OPEN_MS = 280;

function inPlace(el) {
  const top = el.getBoundingClientRect().top;
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const page = document.documentElement;
  const atEnd = window.innerHeight + window.scrollY >= page.scrollHeight - 2;
  return top >= margin - 12 && (top < window.innerHeight * 0.6 || atEnd);
}

/** Briefly highlight the card that was just jumped to. */
export function pulseCard(el) {
  if (!el) return;
  el.classList.remove('is-target');
  void el.offsetWidth;
  el.classList.add('is-target');
  window.setTimeout(() => el.classList.remove('is-target'), 900);
}

// One chip per card. A chip brings its card into view and opens it; pressed
// again while that card is in place, it collapses the card without moving.
export default function JumpBar({ cards }) {
  const barRef = useRef(null);
  const islandRef = useRef(null);
  const platformsRef = useRef(null);
  const pillRef = useRef(null);
  const placedRef = useRef(false);
  const [activeId, setActiveId] = useState(null);
  useIsland(barRef, islandRef);
  const collapsed = useCollapsedIds(cards).split(' ').filter(Boolean);
  const allCollapsed = collapsed.length === cards.length;

  // Glide the active highlight pill smoothly across platform chips as the
  // visitor scrolls or taps a chip, and re-measure when the dock folds.
  useEffect(() => {
    const host = platformsRef.current;
    const pill = pillRef.current;
    const bar = barRef.current;
    if (!host || !pill || !bar) return undefined;

    const sync = (instant = false) => {
      const target = activeId ? host.querySelector(`[data-card="${activeId}"]`) : null;
      if (!target) {
        pill.style.opacity = '0';
        return;
      }
      if (instant) pill.style.transition = 'none';
      pill.style.transform = `translate3d(${target.offsetLeft}px, ${target.offsetTop}px, 0)`;
      pill.style.width = `${target.offsetWidth}px`;
      pill.style.height = `${target.offsetHeight}px`;
      pill.style.opacity = '1';
      if (instant) {
        void pill.offsetWidth;
        pill.style.removeProperty('transition');
      }
    };

    sync(!placedRef.current);
    if (activeId) placedRef.current = true;

    const onLayout = () => sync(true);
    bar.addEventListener('island:layout', onLayout);
    window.addEventListener('resize', onLayout);
    return () => {
      bar.removeEventListener('island:layout', onLayout);
      window.removeEventListener('resize', onLayout);
    };
  }, [activeId, cards.length]);

  // Track whichever card currently sits closest to the top of the reading band.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !cards.length) return undefined;
    const visible = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id.replace(/^card-/, '');
          if (entry.isIntersecting) visible.set(id, entry.boundingClientRect.top);
          else visible.delete(id);
        }
        if (visible.size) {
          let best = null;
          let bestDist = Infinity;
          for (const [id, top] of visible) {
            const dist = Math.abs(top - 130);
            if (dist < bestDist) {
              bestDist = dist;
              best = id;
            }
          }
          if (best) setActiveId(best);
        }
      },
      { rootMargin: '-100px 0px -55% 0px', threshold: [0, 0.25] },
    );
    const elements = cards
      .map((card) => document.getElementById(`card-${card.id}`))
      .filter(Boolean);
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [cards]);

  const jump = (id) => {
    setActiveId(id);
    const el = document.getElementById(`card-${id}`);
    if (!el) return;
    const key = collapsedKey(id);
    const opening = readCollapsed(key);
    if (opening) writeCollapsed(key, false);
    else if (inPlace(el)) return writeCollapsed(key, true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const go = () => {
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      pulseCard(el);
    };
    go();
    if (opening) setTimeout(go, OPEN_MS);
  };

  const setAll = () => {
    for (const card of cards) writeCollapsed(collapsedKey(card.id), !allCollapsed);
  };

  return (
    <nav className="links-jump" ref={barRef} aria-label="link cards">
      <div className="links-jump-island" ref={islandRef}>
        <div className="links-jump-list">
          <div className="links-jump-platforms" ref={platformsRef}>
            <span className="links-jump-pill" ref={pillRef} aria-hidden="true" />
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                className="links-jump-item"
                data-card={card.id}
                data-active={activeId === card.id ? 'true' : undefined}
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
          </div>
          <span className="links-jump-sep" aria-hidden="true" />
          <button
            type="button"
            className="links-jump-item links-jump-all"
            title={allCollapsed ? 'Expand all' : 'Collapse all'}
            aria-label={allCollapsed ? 'Expand all cards' : 'Collapse all cards'}
            onClick={setAll}
          >
            <Icon name={allCollapsed ? 'expand' : 'collapse'} />
            <span className="links-jump-label">{allCollapsed ? 'Expand' : 'Collapse'}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
