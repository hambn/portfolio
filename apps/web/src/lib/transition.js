// View transitions: the browser holds a picture of the page as it was, runs
// `update`, and animates from that picture to the page as it now is. The
// animations themselves are in core.css, picked by <html data-transition>.

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Whether a change made through viewTransition() will animate. */
export const canTransition = () =>
  typeof document.startViewTransition === 'function' && !reducedMotion();

/**
 * Run `update` (the DOM changes; it may return a promise the transition waits
 * for) inside a view transition of the given kind ("route", "theme"). Without
 * the API, or with reduced motion, the update just runs. Returns whether it
 * was animated.
 */
export function viewTransition(kind, update) {
  if (!canTransition()) {
    update();
    return false;
  }
  const root = document.documentElement;
  root.setAttribute('data-transition', kind);
  const transition = document.startViewTransition(update);
  // A newer transition skips this one; only the latest clears the attribute.
  const done = () => {
    if (root.getAttribute('data-transition') === kind && current === transition)
      root.removeAttribute('data-transition');
  };
  current = transition;
  transition.finished.then(done, done);
  return true;
}
let current = null;
