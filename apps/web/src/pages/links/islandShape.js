// islandShape.js — the outline of the nav and the links jump bar as one shape.
//
// The nav and the bar share a single pane of glass (Nav.jsx .nav-surface),
// clipped to the path built here, so there is no seam where the two meet.
// The path is a union of clockwise subpaths, so overlaps fill rather than
// cancel:
//   - the nav strip;
//   - the island, a rounded rect whose top corners square off on contact;
//   - a bridge that forms as the island rises within REACH of the nav, thin
//     at first and widening, with each side bowed inwards like a drop of
//     liquid about to join;
//   - two fillets that, on contact, curve the nav's edge down into the
//     island's sides.

// The island's corner radius, and the fillets' radius once docked.
const RADIUS = 12;
// How close, in px, the island must come before the bridge starts to form.
const REACH = 30;

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const r2 = (n) => Math.round(n * 100) / 100;

/**
 * @param {object} o
 * @param {number} o.width  the nav's width
 * @param {number} o.nav    the nav's height: its bottom edge, in px from the top
 * @param {DOMRect} o.box   the island's box, in the nav's coordinates
 * @param {number} o.merge  0 apart to 1 docked (sprung, so it can overshoot)
 * @returns {string} the path, for clip-path: path() and for an SVG <path d>
 */
export function islandPath({ width, nav, box, merge }) {
  const { left: L, right: R, top: T, bottom: B } = box;
  const gap = Math.max(0, T - nav);
  // The docked shape only holds while the island touches the nav. Pulled away
  // faster than the spring can unwind, it gives way to the bridge at once.
  const contact = merge * clamp01(1 - gap / 4);
  const fillet = RADIUS * Math.max(0, contact);
  const top = RADIUS * clamp01(1 - contact);
  const cx = (L + R) / 2;
  // Half the width of the flat run along the island's top edge.
  const flat = Math.max(0, (R - L) / 2 - top);
  const n = r2(nav);

  let d = `M-2 -2H${r2(width + 2)}V${n}H-2Z`;

  // island: top corners `top`, bottom corners RADIUS
  const b = RADIUS;
  d +=
    `M${r2(L + top)} ${r2(T)}H${r2(R - top)}` +
    `A${r2(top)} ${r2(top)} 0 0 1 ${r2(R)} ${r2(T + top)}` +
    `V${r2(B - b)}A${b} ${b} 0 0 1 ${r2(R - b)} ${r2(B)}` +
    `H${r2(L + b)}A${b} ${b} 0 0 1 ${r2(L)} ${r2(B - b)}` +
    `V${r2(T + top)}A${r2(top)} ${r2(top)} 0 0 1 ${r2(L + top)} ${r2(T)}Z`;

  // bridge
  const near = clamp01(1 - gap / REACH);
  if (near > 0 && gap > 0.25) {
    // The waist opens slowly at first, then quickly as the gap closes.
    const waist = flat * near ** 1.8;
    // Each end flares out by about half the gap, so the curves stay round.
    const flare = Math.min(gap * 0.5, Math.max(0, flat - waist));
    const lo = r2(cx - waist - flare);
    const hi = r2(cx + waist + flare);
    const wl = r2(cx - waist);
    const wr = r2(cx + waist);
    const t = r2(T);
    d +=
      `M${lo} ${r2(nav - 1)}H${hi}V${n}` +
      `C${wr} ${n} ${wr} ${t} ${hi} ${t}V${r2(T + 1)}H${lo}V${t}` +
      `C${wl} ${t} ${wl} ${n} ${lo} ${n}Z`;
  }

  // fillets
  if (fillet > 0.25) {
    const f = r2(fillet);
    const lf = r2(L - fillet);
    const rf = r2(R + fillet);
    const nf = r2(nav + fillet);
    d +=
      `M${lf} ${r2(nav - 1)}H${r2(L + 1)}V${nf}H${r2(L)}A${f} ${f} 0 0 0 ${lf} ${n}Z` +
      `M${r2(R - 1)} ${r2(nav - 1)}H${rf}V${n}A${f} ${f} 0 0 0 ${r2(R)} ${nf}H${r2(R - 1)}Z`;
  }
  return d;
}
