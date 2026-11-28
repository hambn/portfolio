import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildVirtualFs,
  completeInput,
  listDirectory,
  renderTree,
  resolveNode,
  resolvePath,
} from '../src/lib/terminalFs.js';

const sampleFs = buildVirtualFs({
  profile: { name: 'hamed ghasempour', handle: 'hambn', title: 'devops engineer', bio: 'infra' },
  resume: {
    skills: ['linux', 'kubernetes', 'docker'],
    items: [
      { type: 'work', role: 'DevOps Engineer', company: 'Taban', start: '2024', end: 'Present' },
    ],
    branches: [
      {
        name: 'Taban',
        start: 'Apr 2024',
        end: 'Present',
        commits: [{ date: 'Jul 2024', text: 'full-time' }],
      },
    ],
  },
  links: {
    email: { address: 'contact@hgh.dev' },
    discord: { userId: '601127931921563669' },
    github: { username: 'hambn', url: 'https://github.com/hambn' },
  },
  projects: {
    featured: [
      { name: 'portfolio', repo: 'https://github.com/hambn/portfolio', description: 'this site' },
    ],
  },
  posts: [
    {
      slug: 'welcome',
      title: 'Welcome',
      date: '2026-06-22',
      minutes: 2,
      words: 240,
      tags: ['meta'],
    },
    {
      slug: 'gitops-with-argocd',
      title: 'GitOps',
      date: '2026-06-01',
      minutes: 3,
      words: 400,
      tags: ['k8s'],
    },
  ],
});

test('virtual filesystem puts blogs, resume, and links under ~/Documents', () => {
  const rootListing = listDirectory(sampleFs, '~', []);
  assert.equal(rootListing.ok, true);
  assert.ok(rootListing.entries.some((e) => e.name === 'Documents/'));
  assert.ok(rootListing.entries.some((e) => e.name === 'projects/'));
  assert.ok(!rootListing.entries.some((e) => e.name === '.bashrc'));

  const docs = listDirectory(sampleFs, '~/Documents', ['-l']);
  assert.equal(docs.ok, true);
  const blogsRow = docs.entries.find((e) => e.name === 'blogs/');
  const linksRow = docs.entries.find((e) => e.name === 'links/');
  const resumeRow = docs.entries.find((e) => e.name === 'resume/');
  assert.equal(blogsRow.count, 2);
  assert.equal(linksRow.count, 3);
  assert.equal(resumeRow.count, 3);
});

test('ls supports -la, -las, relative paths, and full paths like ~/Documents/blogs/', () => {
  const allRoot = listDirectory(sampleFs, '~', ['-las']);
  assert.equal(allRoot.ok, true);
  assert.equal(allRoot.flags.long, true);
  assert.equal(allRoot.flags.all, true);
  assert.equal(allRoot.flags.size, true);
  assert.ok(allRoot.entries.some((e) => e.name === './'));
  assert.ok(allRoot.entries.some((e) => e.name === '.bashrc'));
  assert.ok(allRoot.totalBlocks > 0);
  // Dotfiles sort before non-hidden directories/files, right after ./ and ../
  const bashrcIdx = allRoot.entries.findIndex((e) => e.name === '.bashrc');
  const docsIdx = allRoot.entries.findIndex((e) => e.name === 'Documents/');
  assert.ok(bashrcIdx > 1 && bashrcIdx < docsIdx);

  const blogsFull = listDirectory(sampleFs, '~/projects', ['~/Documents/blogs/']);
  assert.equal(blogsFull.ok, true);
  assert.equal(blogsFull.targetPath, '~/Documents/blogs');
  assert.deepEqual(
    blogsFull.entries.map((e) => e.name),
    ['gitops-with-argocd.md', 'welcome.md'],
  );

  // Inside ~/Documents/blogs, `ls` without args lists that directory (not root!)
  const blogsCwd = listDirectory(sampleFs, '~/Documents/blogs', []);
  assert.equal(blogsCwd.ok, true);
  assert.equal(blogsCwd.entries.length, 2);
});

test('path resolution handles .., ~, POSIX home paths, and aliases', () => {
  assert.equal(resolvePath('~/Documents/blogs', '..', 'hambn'), '~/Documents');
  assert.equal(resolvePath('~/Documents', '..', 'hambn'), '~');
  assert.equal(resolvePath('~', '/home/hambn/Documents/links/', 'hambn'), '~/Documents/links');
  assert.equal(resolveNode(sampleFs, '~', 'blogs')?.path, '~/Documents/blogs');
  assert.equal(resolveNode(sampleFs, '~', 'blog')?.path, '~/Documents/blogs');
});

test('Tab autocomplete completes commands and nested filesystem paths', () => {
  const cmdHit = completeInput(sampleFs, '~', 'neo', ['help', 'neofetch', 'nvim']);
  assert.equal(cmdHit.replacement, 'neofetch ');

  const dirHit = completeInput(sampleFs, '~', 'ls Doc', ['ls', 'cd']);
  assert.equal(dirHit.replacement, 'ls Documents/');
  assert.equal(dirHit.ghost, 'uments/');

  const fileHit = completeInput(sampleFs, '~', 'vim ~/Documents/blogs/git', ['vim']);
  assert.equal(fileHit.replacement, 'vim ~/Documents/blogs/gitops-with-argocd.md');

  const tree = renderTree(sampleFs, '~');
  assert.equal(tree.ok, true);
  assert.ok(tree.text.includes('blogs/ (2)'));
  assert.ok(tree.text.includes('links/ (3)'));
});
