import { useCallback, useEffect, useState } from 'react';
import { PortfolioData } from '../lib/data.js';

const LOADERS = {
  profile: PortfolioData.getProfile,
  resume: PortfolioData.getResume,
  links: PortfolioData.getLinks,
  blogIndex: PortfolioData.getBlogIndex,
};

/**
 * One piece of site content ('profile' | 'resume' | 'links' | 'blogIndex').
 * `data` starts as what the page already carries (PortfolioData.peek), so a
 * prerendered page hydrates without a loading state, and is refreshed by the
 * request. `error` is true once that request has failed; `retry` asks again.
 */
export function useContent(key) {
  const [data, setData] = useState(() => PortfolioData.peek(key));
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(false);
    LOADERS[key]()
      .then((loaded) => {
        if (alive) setData(loaded);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, error, retry };
}
