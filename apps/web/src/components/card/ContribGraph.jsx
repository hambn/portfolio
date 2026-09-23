// GitHub / GitLab contribution graph.
// GitHub data comes from the API's /github/contributions route (seeded by the
// /links batch). GitLab has no public calendar, so its card draws a random
// placeholder grid on every visit, as GitHub does when its data is unavailable.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiUrl } from '../../lib/api.js';
import { useCardFeed } from '../../pages/links/LinksFeed.jsx';

const GH_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const GAP = '2.2px';
const DAYW = '22px';

export function ContribGraph({ username, source, levels, theme }) {
  const [weeks, setWeeks] = useState(null);
  const [hover, setHover] = useState(null); // tooltip label
  // Seeded from the one-shot /links batch; freshness is judged inside the effect
  // so a card expanded long after the batch settled still re-fetches.
  const seed = useCardFeed('githubContributions');
  const seedRef = useRef(seed);
  seedRef.current = seed;
  const synthetic = useRef(null);
  // Only GitHub reads the feed; a synthetic grid has nothing to redo when it settles.
  const generation = source === 'github' ? seed.generation : 0;

  const buildWeeks = (days) => {
    const wk = [];
    let cur = [];
    days.forEach((day, i) => {
      const dow = new Date(day.date + 'T00:00:00').getDay();
      if (i === 0) for (let k = 0; k < dow; k++) cur.push(null);
      cur.push(day);
      if (dow === 6) {
        wk.push(cur);
        cur = [];
      }
    });
    if (cur.length) {
      while (cur.length < 7) cur.push(null);
      wk.push(cur);
    }
    return wk.slice(-53);
  };

  useEffect(() => {
    if (!username) return;
    let cancelled = false;

    const synth = () => {
      const days = [];
      const end = new Date();
      for (let i = 364; i >= 0; i--) {
        const d = new Date(end);
        d.setDate(end.getDate() - i);
        // weekends quieter, weekdays busier — plausible-looking pattern
        const dow = d.getDay();
        const base = dow === 0 || dow === 6 ? 0.25 : 0.6;
        const r = Math.random();
        const count = r < 1 - base ? 0 : Math.floor(r * 12);
        const level = count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 10 ? 3 : 4;
        days.push({ date: d.toISOString().slice(0, 10), count, level });
      }
      return days;
    };

    if (source === 'github') {
      const fresh = seedRef.current;
      if (fresh.status === 'pending') return undefined; // wait for the batch to settle
      const seeded = fresh.status === 'ready' ? fresh.data?.contributions : null;
      if (
        Array.isArray(seeded) &&
        seeded.length &&
        Date.now() - fresh.receivedAt < (fresh.maxAgeMs || 0)
      ) {
        setWeeks(buildWeeks(seeded));
        return undefined;
      }
      fetch(apiUrl(`/github/contributions?username=${encodeURIComponent(username)}`))
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          if (cancelled) return;
          const days = d?.contributions;
          if (!Array.isArray(days) || !days.length) throw new Error('no data');
          setWeeks(buildWeeks(days));
        })
        .catch(() => {
          if (!cancelled) setWeeks(buildWeeks(synth()));
        });
    } else {
      // Keep one synthetic grid per user so an unrelated feed update can't reshuffle it.
      if (synthetic.current?.key !== `${source}:${username}`)
        synthetic.current = { key: `${source}:${username}`, days: synth() };
      setWeeks(buildWeeks(synthetic.current.days));
    }

    return () => {
      cancelled = true;
    };
  }, [username, source, generation]);

  // Month labels: every month, evenly distributed so gaps are uniform across the row.
  const monthLabels = useMemo(() => {
    const labels = [];
    let lastMonth = -1;
    weeks?.forEach((w, i) => {
      const firstDay = w.find(Boolean);
      if (!firstDay) return;
      const m = new Date(firstDay.date + 'T00:00:00').getMonth();
      if (m !== lastMonth) {
        labels.push({ i, label: GH_MONTHS[m] });
        lastMonth = m;
      }
    });
    // Drop the leading partial-month label (it would duplicate the trailing month)
    if (labels.length > 1 && labels[1].i - labels[0].i < 3) labels.shift();
    return labels;
  }, [weeks]);

  // The ~371 cells only change with the data; hovering updates the tooltip line
  // alone, and the ring is a CSS :hover (.cg-day in cards.css).
  const grid = useMemo(
    () =>
      weeks?.map((w, wi) => (
        <div
          key={wi}
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: GAP }}
        >
          {w.map((day, di) => (
            <div
              key={di}
              className={day ? 'cg-day' : undefined}
              onMouseEnter={() =>
                day &&
                setHover(`${day.count} contribution${day.count === 1 ? '' : 's'} on ${day.date}`)
              }
              onMouseLeave={() => setHover(null)}
              style={{
                width: '100%',
                aspectRatio: '1 / 1',
                borderRadius: '2px',
                background: day ? levels[day.level] : 'transparent',
                outline: day ? '1px solid rgba(255,255,255,0.04)' : 'none',
                outlineOffset: '-1px',
              }}
            />
          ))}
        </div>
      )),
    [weeks, levels],
  );

  if (!weeks) {
    return (
      <div
        style={{
          padding: '16px 20px',
          borderTop: `1px solid ${theme.div}`,
          fontSize: '12px',
          color: theme.faint,
        }}
      >
        loading contributions…
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '14px 20px 16px',
        borderTop: `1px solid ${theme.div}`,
        '--cg-ring': theme.muted,
      }}
    >
      {/* Month labels — evenly spaced */}
      <div style={{ display: 'flex' }}>
        <div style={{ width: DAYW, flexShrink: 0 }} />
        <div
          style={{
            position: 'relative',
            flex: 1,
            minWidth: 0,
            height: '13px',
            containerType: 'inline-size',
          }}
        >
          {monthLabels.map(({ label }, idx) => (
            <span
              key={idx}
              style={{
                position: 'absolute',
                left: `${(idx / monthLabels.length) * 100}%`,
                fontSize: 'clamp(6.5px, 3.6cqw, 10.5px)',
                color: theme.faint,
                whiteSpace: 'nowrap',
                lineHeight: 1,
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: GAP }}>
        {/* Day-of-week labels */}
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: GAP, width: DAYW, flexShrink: 0 }}
        >
          {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
            <span
              key={i}
              style={{
                flex: 1,
                fontSize: '8.5px',
                lineHeight: 1,
                color: theme.faint,
                textAlign: 'right',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              {d}
            </span>
          ))}
        </div>

        {/* Week columns — flex so the grid scales to fit, never scrolls */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: GAP }}>{grid}</div>
      </div>

      {/* Legend + tooltip line */}
      <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px', minHeight: '15px' }}>
        <span
          style={{ fontSize: '11px', color: theme.muted, marginRight: 'auto', minHeight: '15px' }}
        >
          {hover || ''}
        </span>
        <span style={{ fontSize: '10px', color: theme.faint, marginRight: '5px' }}>Less</span>
        <div style={{ display: 'flex', gap: '3px' }}>
          {levels.map((c, i) => (
            <div
              key={i}
              style={{
                width: '11px',
                height: '11px',
                borderRadius: '2px',
                background: c,
                outline: '1px solid rgba(255,255,255,0.04)',
                outlineOffset: '-1px',
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: '10px', color: theme.faint, marginLeft: '5px' }}>More</span>
      </div>
    </div>
  );
}
