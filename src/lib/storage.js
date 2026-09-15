// localStorage access that never throws: private mode, ITP and locked-down
// webviews reject reads and writes, and a render-time throw would blank the app.
export const storage = {
  get(key, fallback = null) {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  },
};
