import { useEffect } from 'react';
import { islandPath } from './islandShape.js';

// How the bar folds between its two layouts as it docks and undocks.
const FOLD = { duration: 460, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' };
// The spring that merges the island into the nav once they touch: a little
// under critically damped, so the join lands with the faintest overshoot.
const SPRING = { stiffness: 320, damping: 26 };

// The jump bar and the nav are drawn as one shape (islandShape.js). Out of
// reach of the nav the bar is an island of its own; scrolled up close, a
// bridge forms between them, and once they touch, the island's top corners
// turn into fillets that run into the nav's edge. The bridge follows the
// scroll position, and the join is sprung, so both move with the page
// rather than on a timer.
//
// Docked, a wide bar also folds down to a strip of logos. Its size animates
// from the old layout to the new one, and the bar's bottom margin takes up
// the difference in height, so the cards below never move.
export function useIsland(barRef, islandRef) {
  useEffect(() => {
    const bar = barRef.current;
    const island = islandRef.current;
    const list = island?.firstElementChild;
    const nav = document.querySelector('.site-nav');
    const surface = nav?.querySelector('.nav-surface');
    const edge = nav?.querySelector('.nav-edge');
    if (!bar || !list || !surface || !edge) return undefined;
    const shapes = edge.querySelectorAll('.nav-edge-shape');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let stick = 0;
    let frame = 0;
    let then = 0;
    let docked = false;
    let folds = [];
    let merge = 0;
    let speed = 0;

    nav.setAttribute('data-island', '');
    bar.setAttribute('data-surface', '');

    const fold = (next) => {
      const from = island.getBoundingClientRect();
      const fromMargin = getComputedStyle(bar).marginBottom;
      folds.forEach((run) => run.cancel());
      // The undocked height is the footprint the cards are laid out against.
      bar.removeAttribute('data-docked');
      bar.style.removeProperty('--jump-slack');
      const full = island.offsetHeight;
      bar.toggleAttribute('data-docked', next);
      const to = island.getBoundingClientRect();
      bar.style.setProperty('--jump-slack', `${full - to.height}px`);
      if (motion.matches) return;
      const size = (r) => ({ width: `${r.width}px`, height: `${r.height}px` });
      const toMargin = getComputedStyle(bar).marginBottom;
      folds = [
        island.animate([size(from), size(to)], FOLD),
        bar.animate([{ marginBottom: fromMargin }, { marginBottom: toMargin }], FOLD),
      ];
      // Only a change of layout needs the logos to fade through it.
      if (Math.abs(from.width - to.width) > 2 || Math.abs(from.height - to.height) > 2) {
        folds.push(
          list.animate(
            [
              { opacity: 0, transform: 'scale(0.94)', filter: 'blur(3px)' },
              { opacity: 1, transform: 'none', filter: 'blur(0)' },
            ],
            {
              duration: 340,
              delay: 110,
              easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
              fill: 'backwards',
            },
          ),
        );
      }
    };

    const draw = () => {
      const box = island.getBoundingClientRect();
      const height = nav.offsetHeight;
      const d = islandPath({ width: nav.clientWidth, nav: height, box, merge });
      const tall = `${Math.ceil(Math.max(height, box.bottom)) + 2}px`;
      surface.style.height = tall;
      surface.style.clipPath = `path('${d}')`;
      edge.style.height = tall;
      shapes.forEach((shape) => shape.setAttribute('d', d));
    };

    const tick = (now) => {
      frame = 0;
      const dt = then ? Math.min(0.032, (now - then) / 1000) : 0;
      then = now;
      const next = bar.getBoundingClientRect().top <= stick + 0.5;
      if (next !== docked) {
        docked = next;
        fold(next);
      }
      const target = docked ? 1 : 0;
      if (motion.matches) {
        merge = target;
        speed = 0;
      } else {
        speed += (SPRING.stiffness * (target - merge) - SPRING.damping * speed) * dt;
        merge += speed * dt;
        if (Math.abs(target - merge) < 0.001 && Math.abs(speed) < 0.01) {
          merge = target;
          speed = 0;
        }
      }
      draw();
      const folding = folds.some((run) => run.playState === 'running');
      if (merge !== target || folding) schedule();
      else then = 0;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const onResize = () => {
      stick = parseFloat(getComputedStyle(bar).top) || 0;
      // Fold again from scratch so the slack fits the new layout.
      if (docked) {
        docked = false;
        folds.forEach((run) => run.cancel());
        bar.removeAttribute('data-docked');
        bar.style.removeProperty('--jump-slack');
      }
      schedule();
    };

    onResize();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', onResize);
      folds.forEach((run) => run.cancel());
      nav.removeAttribute('data-island');
      surface.style.removeProperty('height');
      surface.style.removeProperty('clip-path');
      edge.style.removeProperty('height');
      shapes.forEach((shape) => shape.removeAttribute('d'));
    };
  }, [barRef, islandRef]);
}
