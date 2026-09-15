import { useState } from 'react';

/** Copy text to clipboard with 2s "copied!" feedback (execCommand fallback). */
export function useCopy(text) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    const fb = () => {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      done();
    };
    try {
      navigator.clipboard.writeText(text).then(done).catch(fb);
    } catch {
      fb();
    }
  };
  return [copied, copy];
}
