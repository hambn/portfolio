// Which commit this build is, for the footer's status line. Imported by both
// vite.config.js and the prerenderer, so the client bundle and the prerendered
// HTML carry the same values and hydration matches. The commit date is used
// rather than "now" for the same reason: the two steps run at different times.
// Where there is no git checkout (the Docker build) pass VITE_BUILD_SHA and
// VITE_BUILD_DATE yourself, or leave them unset and the footer omits them.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('.', import.meta.url));
const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
};

process.env.VITE_BUILD_SHA ||= git('rev-parse', '--short=7', 'HEAD');
process.env.VITE_BUILD_DATE ||= git('log', '-1', '--format=%cs');
