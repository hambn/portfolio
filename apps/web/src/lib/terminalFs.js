// Virtual Unix filesystem for the interactive terminal (components/Terminal.jsx).
// Pure JS (no JSX or browser APIs) so path resolution, `ls` flags, directory
// item counts, tree rendering, and Tab autocomplete are cleanly unit-tested.
import { buildLinkServices } from './linksDirectory.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return 'Nov 28';
  return `${MONTHS[Math.max(0, Math.min(11, Number(m[2]) - 1))]} ${String(Number(m[3])).padStart(2, ' ')}`;
}

function fmtBytes(bytes, human) {
  if (!human) return String(bytes);
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}K`;
}

function dir(name, children, meta = {}) {
  return { kind: 'dir', name, children, ...meta };
}

function file(name, content, meta = {}) {
  const text = String(content ?? '');
  return {
    kind: meta.kind || 'file',
    name,
    content: text,
    size: meta.size ?? text.length,
    date: meta.date || '2026-11-28',
    ...meta,
  };
}

/**
 * Construct the virtual filesystem tree under `~` (`/home/<handle>`) from live
 * portfolio content. Layout:
 *   ~/
 *     .bashrc, .profile, .gitconfig
 *     README.md, stack.txt
 *     projects/
 *     Documents/
 *       blogs/
 *       resume/
 *       links/
 */
export function buildVirtualFs({
  profile = {},
  resume = {},
  links = {},
  projects = {},
  posts = [],
  liveProjects = [],
  origin = 'https://hgh.dev',
} = {}) {
  const handle = profile.handle || 'hambn';
  const featured = projects.featured || [];
  const seenRepos = new Set();

  const projectFiles = [];
  for (const item of featured) {
    const slug = (item.repo?.split('/').pop() || item.name || 'project').toLowerCase();
    seenRepos.add(slug);
    const body = [
      `# ${item.name || slug}`,
      '',
      item.description || 'Featured repository.',
      '',
      ...(item.repo ? [`Repository: ${item.repo}`] : []),
      ...(item.homepage ? [`Homepage:   ${item.homepage}`] : []),
      ...(item.topics?.length ? [`Topics:     ${item.topics.join(', ')}`] : []),
    ].join('\n');
    projectFiles.push(
      file(`${slug}.md`, body, {
        route: 'projects',
        href: item.repo || item.homepage,
        filetype: 'markdown',
        featured: true,
      }),
    );
  }
  for (const section of liveProjects) {
    for (const repo of section.repos || []) {
      const slug = String(repo.name || '').toLowerCase();
      if (!slug || seenRepos.has(slug)) continue;
      seenRepos.add(slug);
      const body = [
        `# ${repo.name}`,
        '',
        repo.description || '(no description)',
        '',
        `Host:       ${section.host}`,
        ...(repo.language ? [`Language:   ${repo.language}`] : []),
        ...(repo.stars ? [`Stars:      ${repo.stars}`] : []),
        ...(repo.url ? [`URL:        ${repo.url}`] : []),
        ...(repo.homepage ? [`Homepage:   ${repo.homepage}`] : []),
        ...(repo.pushedAt ? [`Updated:    ${String(repo.pushedAt).slice(0, 10)}`] : []),
      ].join('\n');
      projectFiles.push(
        file(`${slug}.md`, body, {
          route: 'projects',
          href: repo.url,
          date: repo.pushedAt || '2026-11-28',
          filetype: 'markdown',
        }),
      );
    }
  }

  const blogFiles = posts.map((post) => {
    const summary = [
      `# ${post.title}`,
      '',
      `${(post.date || '').slice(0, 10)} · ${post.minutes || 1} min read · ${(post.tags || []).join(', ')}`,
      '',
      post.description || '',
      '',
      `Route: ~/Documents/blogs/${post.slug}.md  ->  ${origin}/blog/${post.slug}/`,
    ].join('\n');
    return file(`${post.slug}.md`, summary, {
      slug: post.slug,
      post,
      route: `blog/${post.slug}`,
      date: post.date || '2026-11-28',
      size: Math.max(summary.length, (post.words || 120) * 6),
      filetype: 'markdown',
    });
  });

  const resumeItems = resume.items || [];
  const resumeMd = [
    `# ${profile.name || handle} — Resume`,
    profile.title ? `> ${profile.title}` : '',
    '',
    ...resumeItems.flatMap((item) => [
      `## ${item.role || item.degree || item.title || ''} — ${item.company || item.school || ''}`,
      [[item.start, item.end].filter(Boolean).join(' – '), item.employment, item.location]
        .filter(Boolean)
        .join(' · '),
      '',
      ...(Array.isArray(item.description) ? item.description : [item.description])
        .filter(Boolean)
        .map((line) => `- ${line}`),
      '',
    ]),
    ...(resume.skills?.length ? ['## Skills', '', resume.skills.join(', '), ''] : []),
  ]
    .filter((line) => line !== undefined)
    .join('\n');

  const experienceLog = (resume.branches || [])
    .map(
      (b) =>
        `* (${b.name})  ${b.start} – ${b.end}\n` +
        [...(b.commits || [])]
          .reverse()
          .map((c) => `  ${c.date.padEnd(9)} ${c.text}`)
          .join('\n'),
    )
    .join('\n\n');

  const skillsTxt = (resume.skills || []).join('\n');

  const services = buildLinkServices(links, profile);
  const linkFiles = services.map((service) => {
    const share = `${origin}/links/${service.slug}/`;
    const body = [
      `[${service.label}]`,
      `Handle = ${service.handle}`,
      `URL    = ${service.url}`,
      `Share  = ${share}`,
      `Note   = ${service.tagline}`,
    ].join('\n');
    return file(`${service.slug}.url`, body, {
      kind: 'link',
      service,
      href: service.url,
      route: `links/${service.slug}`,
      filetype: 'ini',
    });
  });

  const readme = [
    `# ${profile.name || handle} (@${handle})`,
    '',
    profile.bio || 'DevOps engineer building and operating systems end to end.',
    '',
    '## Directory Layout',
    '',
    '- ~/projects/             featured & public git repositories',
    '- ~/Documents/blogs/      technical posts (Markdown)',
    '- ~/Documents/resume/     resume, career git log, skills',
    '- ~/Documents/links/      social & contact endpoints',
  ].join('\n');

  const bashrc = [
    `# ~/.bashrc — ${handle}@hgh.dev`,
    'export EDITOR="nvim"',
    'export VISUAL="nvim"',
    'export LANG="en_US.UTF-8"',
    'alias ll="ls -la"',
    'alias la="ls -las"',
    'alias v="nvim"',
  ].join('\n');

  const profileRc = [
    `# ~/.profile`,
    `USER="${handle}"`,
    `HOME="/home/${handle}"`,
    'PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"',
  ].join('\n');

  const gitconfig = [
    '[user]',
    `  name = ${profile.name || handle}`,
    ...(links.email?.address ? [`  email = ${links.email.address}`] : []),
    '[init]',
    '  defaultBranch = main',
    '[core]',
    '  editor = nvim',
  ].join('\n');

  const root = dir(
    '~',
    [
      file('.bashrc', bashrc, { hidden: true, filetype: 'sh' }),
      file('.profile', profileRc, { hidden: true, filetype: 'sh' }),
      file('.gitconfig', gitconfig, { hidden: true, filetype: 'ini' }),
      file('README.md', readme, { route: 'home', filetype: 'markdown' }),
      file('stack.txt', skillsTxt || 'linux', { route: 'home', filetype: 'text' }),
      dir('projects', projectFiles, { route: 'projects' }),
      dir(
        'Documents',
        [
          dir('blogs', blogFiles, { route: 'blog' }),
          dir(
            'resume',
            [
              file('resume.md', resumeMd, { route: 'resume', filetype: 'markdown' }),
              file('experience.log', experienceLog || 'no history', {
                route: 'resume',
                filetype: 'log',
              }),
              file('skills.txt', skillsTxt || 'linux', { route: 'resume', filetype: 'text' }),
            ],
            { route: 'resume' },
          ),
          dir('links', linkFiles, { route: 'links' }),
        ],
        {},
      ),
    ],
    { route: 'home' },
  );

  return { handle, home: `/home/${handle}`, root };
}

/** Map a site route ("home", "blog", "blog/welcome", "links", "resume", "projects") to a VFS path. */
export function routeToVfsPath(route) {
  const clean = String(route || 'home').replace(/^\/+|\/+$/g, '');
  if (!clean || clean === 'home') return '~';
  if (clean === 'projects') return '~/projects';
  if (clean === 'blog' || clean.startsWith('blog/')) return '~/Documents/blogs';
  if (clean === 'links' || clean.startsWith('links/')) return '~/Documents/links';
  if (clean === 'resume') return '~/Documents/resume';
  return '~';
}

/** Normalize a VFS path relative to `cwd` into canonical `~` form (e.g. `~/Documents/blogs`). */
export function resolvePath(cwd, rawInput = '', handle = 'hambn') {
  const raw = String(rawInput || '').trim();
  if (!raw) return cwd || '~';
  let input = raw;
  const homePrefix = `/home/${handle}`;
  if (
    input === '~' ||
    input === '~/' ||
    input === homePrefix ||
    input === `${homePrefix}/` ||
    input === '/'
  )
    return '~';
  if (input.startsWith(`${homePrefix}/`)) input = `~/${input.slice(homePrefix.length + 1)}`;
  else if (input.startsWith('/')) input = `~${input}`;

  const base = input.startsWith('~/')
    ? []
    : (cwd || '~') === '~'
      ? []
      : (cwd || '~').slice(2).split('/').filter(Boolean);
  const rel = input.startsWith('~/') ? input.slice(2) : input;
  const stack = [...base];

  for (const part of rel.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.length ? `~/${stack.join('/')}` : '~';
}

/** Convert canonical `~` path to full POSIX path (`/home/hambn/Documents/blogs`). */
export function toPosixPath(vfsPath, handle = 'hambn') {
  if (!vfsPath || vfsPath === '~') return `/home/${handle}`;
  return `/home/${handle}/${vfsPath.slice(2)}`;
}

const TOP_ALIASES = {
  blog: '~/Documents/blogs',
  blogs: '~/Documents/blogs',
  links: '~/Documents/links',
  resume: '~/Documents/resume',
  home: '~',
};

/** Look up a node by canonical VFS path (case-insensitive segment fallback for convenience). */
export function getNode(fs, vfsPath) {
  if (!vfsPath || vfsPath === '~') return { node: fs.root, path: '~' };
  const segments = vfsPath.replace(/^~\/?/, '').split('/').filter(Boolean);
  let cur = fs.root;
  const exactSegments = [];
  for (const seg of segments) {
    if (cur.kind !== 'dir') return null;
    const hit =
      cur.children.find((child) => child.name === seg) ||
      cur.children.find((child) => child.name.toLowerCase() === seg.toLowerCase()) ||
      // Allow omitting .md / .url extension when referencing a file directly
      cur.children.find(
        (child) =>
          child.kind !== 'dir' &&
          child.name.replace(/\.(md|url|txt|log)$/i, '').toLowerCase() === seg.toLowerCase(),
      );
    if (!hit) return null;
    cur = hit;
    exactSegments.push(hit.name);
  }
  return { node: cur, path: exactSegments.length ? `~/${exactSegments.join('/')}` : '~' };
}

/**
 * Resolve a user-typed path against the VFS, falling back to ergonomic top-level
 * aliases (`blogs`, `blog`, `links`, `resume`) when no literal child matches.
 */
export function resolveNode(fs, cwd, rawInput = '') {
  const directPath = resolvePath(cwd, rawInput, fs.handle);
  const direct = getNode(fs, directPath);
  if (direct) return direct;

  // Ergonomic shorthand: e.g. `cd blogs`, `ls ~/blog`, `cat blog/welcome`
  const cleaned = String(rawInput || '')
    .trim()
    .replace(/^~\/?|^\/+/, '');
  const [first, ...rest] = cleaned.split('/').filter(Boolean);
  const aliasBase = first && TOP_ALIASES[first.toLowerCase()];
  if (aliasBase) {
    const aliased = rest.length ? `${aliasBase}/${rest.join('/')}` : aliasBase;
    return getNode(fs, aliased);
  }
  return null;
}

/** Parse GNU/BSD-style `ls` flags (`-l`, `-a`, `-s`, `-h`, `-1`, `-r`, `-t`, `-las`, etc.). */
export function parseLsArgs(tokens = []) {
  const flags = {
    long: false,
    all: false,
    size: false,
    human: false,
    one: false,
    reverse: false,
    time: false,
  };
  const paths = [];
  for (const tok of tokens) {
    if (tok.startsWith('-') && tok.length > 1) {
      for (const ch of tok.slice(1)) {
        if (ch === 'l') flags.long = true;
        else if (ch === 'a' || ch === 'A') flags.all = true;
        else if (ch === 's') flags.size = true;
        else if (ch === 'h') flags.human = true;
        else if (ch === '1') flags.one = true;
        else if (ch === 'r') flags.reverse = true;
        else if (ch === 't') flags.time = true;
        else return { error: `ls: invalid option -- '${ch}'` };
      }
    } else {
      paths.push(tok);
    }
  }
  return { flags, paths };
}

/** Count visible entries inside a directory node. */
export function visibleCount(dirNode) {
  if (!dirNode || dirNode.kind !== 'dir') return 0;
  return dirNode.children.filter((c) => !c.hidden).length;
}

function formatEntryRow(node, absPath, handle, flags) {
  const isDir = node.kind === 'dir';
  const isLink = node.kind === 'link';
  const count = isDir ? visibleCount(node) : 1;
  const blocks = isDir
    ? Math.max(4, count * 4)
    : Math.max(4, Math.ceil((node.size || 64) / 1024) * 4);
  const perms = isDir ? 'drwxr-xr-x' : isLink ? 'lrwxrwxrwx' : '-rw-r--r--';
  const sizeLabel = isDir
    ? `${count} ${count === 1 ? 'item' : 'items'}`
    : fmtBytes(node.size || 0, flags.human);
  return {
    name: isDir ? `${node.name}/` : node.name,
    rawName: node.name,
    kind: node.kind,
    hidden: Boolean(node.hidden),
    absPath,
    perms,
    links: isDir ? count + 2 : 1,
    count,
    blocks,
    owner: handle,
    group: 'staff',
    sizeLabel,
    date: fmtDate(node.date),
    route: node.route,
    href: node.href,
    post: node.post,
  };
}

/** Execute `ls` against the virtual filesystem, returning structured entries. */
export function listDirectory(fs, cwd, tokens = []) {
  const parsed = parseLsArgs(tokens);
  if (parsed.error) return { ok: false, error: parsed.error };
  const { flags, paths } = parsed;
  const rawTarget = paths[0] || '';
  const resolved = resolveNode(fs, cwd, rawTarget);
  if (!resolved) {
    return {
      ok: false,
      error: `ls: cannot access '${rawTarget}': No such file or directory`,
    };
  }

  const { node, path } = resolved;
  if (node.kind !== 'dir') {
    const row = formatEntryRow(node, path, fs.handle, flags);
    return {
      ok: true,
      targetPath: path,
      flags,
      totalBlocks: row.blocks,
      entries: [row],
    };
  }

  let children = node.children.filter((c) => flags.all || !c.hidden);
  if (flags.time) {
    children = [...children].sort((a, b) =>
      String(b.date || '').localeCompare(String(a.date || '')),
    );
  } else {
    // Classic Unix ordering: dotfiles first (after ./ and ../), then directories, then files.
    children = [...children].sort((a, b) => {
      if (a.hidden && !b.hidden) return -1;
      if (!a.hidden && b.hidden) return 1;
      if (a.kind === 'dir' && b.kind !== 'dir') return -1;
      if (a.kind !== 'dir' && b.kind === 'dir') return 1;
      return a.name.localeCompare(b.name);
    });
  }
  if (flags.reverse) children.reverse();

  const entries = [];
  if (flags.all) {
    entries.push({
      name: './',
      rawName: '.',
      kind: 'dir',
      hidden: true,
      absPath: path,
      perms: 'drwxr-xr-x',
      links: visibleCount(node) + 2,
      count: visibleCount(node),
      blocks: 4,
      owner: fs.handle,
      group: 'staff',
      sizeLabel: `${visibleCount(node)} items`,
      date: 'Nov 28',
    });
    const parentPath = resolvePath(path, '..', fs.handle);
    const parentNode = getNode(fs, parentPath)?.node || fs.root;
    entries.push({
      name: '../',
      rawName: '..',
      kind: 'dir',
      hidden: true,
      absPath: parentPath,
      perms: 'drwxr-xr-x',
      links: visibleCount(parentNode) + 2,
      count: visibleCount(parentNode),
      blocks: 4,
      owner: fs.handle,
      group: 'staff',
      sizeLabel: `${visibleCount(parentNode)} items`,
      date: 'Nov 28',
    });
  }

  for (const child of children) {
    const childPath = path === '~' ? `~/${child.name}` : `${path}/${child.name}`;
    entries.push(formatEntryRow(child, childPath, fs.handle, flags));
  }

  const totalBlocks = entries.reduce((sum, item) => sum + item.blocks, 0);
  return {
    ok: true,
    targetPath: path,
    flags,
    totalBlocks,
    entries,
  };
}

/** Render an authentic Unicode `tree` view with directory item counts. */
export function renderTree(fs, cwd, rawTarget = '') {
  const resolved = resolveNode(fs, cwd, rawTarget);
  if (!resolved) return { ok: false, error: `tree: '${rawTarget}': No such file or directory` };
  if (resolved.node.kind !== 'dir') return { ok: true, text: resolved.path };

  let dirs = 0;
  let files = 0;
  const lines = [resolved.path];

  const walk = (node, prefix) => {
    const kids = node.children.filter((c) => !c.hidden);
    kids.forEach((child, idx) => {
      const last = idx === kids.length - 1;
      const branch = last ? '└── ' : '├── ';
      if (child.kind === 'dir') {
        dirs += 1;
        const count = visibleCount(child);
        lines.push(`${prefix}${branch}${child.name}/ (${count})`);
        walk(child, `${prefix}${last ? '    ' : '│   '}`);
      } else {
        files += 1;
        lines.push(`${prefix}${branch}${child.name}`);
      }
    });
  };
  walk(resolved.node, '');
  lines.push(
    '',
    `${dirs} ${dirs === 1 ? 'directory' : 'directories'}, ${files} ${files === 1 ? 'file' : 'files'}`,
  );
  return { ok: true, text: lines.join('\n') };
}

function commonPrefix(strings) {
  if (!strings.length) return '';
  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    while (prefix && !strings[i].toLowerCase().startsWith(prefix.toLowerCase())) {
      prefix = prefix.slice(0, -1);
    }
  }
  return prefix;
}

const PATH_COMMANDS = new Set(['ls', 'cd', 'cat', 'vi', 'vim', 'nvim', 'open', 'tree']);

/**
 * Compute Tab autocomplete & live inline ghost suggestion for the current input.
 * Supports commands, subcommands (`theme dark`, `git log`), and nested VFS paths
 * (`ls ~/Doc` -> `ls ~/Documents/`, `vim Documents/blogs/git` -> `vim Documents/blogs/gitops-with-argocd.md`).
 */
export function completeInput(fs, cwd, rawInput, commands) {
  const raw = String(rawInput || '');
  if (!raw.trim()) return { replacement: null, ghost: '', candidates: [] };

  const endsWithSpace = /\s$/.test(raw);
  const tokens = raw.trimStart().split(/\s+/);

  // 1. Completing the command name itself
  if (tokens.length === 1 && !endsWithSpace) {
    const partial = tokens[0].toLowerCase();
    const matches = commands.filter((c) => c.startsWith(partial));
    if (!matches.length) return { replacement: null, ghost: '', candidates: [] };
    if (matches.length === 1) {
      const full = matches[0];
      return {
        replacement: `${full} `,
        ghost: full.slice(tokens[0].length),
        candidates: matches,
      };
    }
    const lcp = commonPrefix(matches);
    return {
      replacement: lcp.length > tokens[0].length ? lcp : null,
      ghost: matches[0].slice(tokens[0].length),
      candidates: matches,
    };
  }

  const cmd = tokens[0].toLowerCase();
  const argToken = endsWithSpace ? '' : tokens[tokens.length - 1];
  const prefixTokens = endsWithSpace ? tokens : tokens.slice(0, -1);
  const lead = `${prefixTokens.join(' ')} `;

  // Special subcommand completions
  if (cmd === 'theme') {
    const opts = ['dark', 'light'].filter((o) => o.startsWith(argToken.toLowerCase()));
    if (!opts.length) return { replacement: null, ghost: '', candidates: [] };
    return {
      replacement: `${lead}${opts[0]}`,
      ghost: opts[0].slice(argToken.length),
      candidates: opts,
    };
  }
  if (cmd === 'git') {
    if ('log'.startsWith(argToken.toLowerCase())) {
      return {
        replacement: `${lead}log`,
        ghost: 'log'.slice(argToken.length),
        candidates: ['log'],
      };
    }
    return { replacement: null, ghost: '', candidates: [] };
  }

  if (!PATH_COMMANDS.has(cmd)) return { replacement: null, ghost: '', candidates: [] };
  // Don't complete flags like `-la` as paths
  if (argToken.startsWith('-')) return { replacement: null, ghost: '', candidates: [] };

  // Split argToken into directory prefix + leaf partial
  const slashIdx = argToken.lastIndexOf('/');
  const dirPart = slashIdx >= 0 ? argToken.slice(0, slashIdx + 1) : '';
  const leafPart = slashIdx >= 0 ? argToken.slice(slashIdx + 1) : argToken;
  const searchDirPath = dirPart ? resolvePath(cwd, dirPart, fs.handle) : cwd;
  const dirResolved = getNode(fs, searchDirPath);
  if (!dirResolved || dirResolved.node.kind !== 'dir') {
    return { replacement: null, ghost: '', candidates: [] };
  }

  const showHidden = leafPart.startsWith('.');
  const dirsOnly = cmd === 'cd' || cmd === 'tree';
  const matches = dirResolved.node.children
    .filter((child) => {
      if (!showHidden && child.hidden) return false;
      if (dirsOnly && child.kind !== 'dir') return false;
      return child.name.toLowerCase().startsWith(leafPart.toLowerCase());
    })
    .map((child) => (child.kind === 'dir' ? `${child.name}/` : child.name))
    .sort((a, b) => a.localeCompare(b));

  if (!matches.length) return { replacement: null, ghost: '', candidates: [] };
  const first = matches[0];
  const ghost = first.toLowerCase().startsWith(leafPart.toLowerCase())
    ? first.slice(leafPart.length)
    : '';
  if (matches.length === 1) {
    return {
      replacement: `${lead}${dirPart}${first}`,
      ghost,
      candidates: matches,
    };
  }
  const lcp = commonPrefix(matches);
  return {
    replacement: lcp.length > leafPart.length ? `${lead}${dirPart}${lcp}` : null,
    ghost,
    candidates: matches,
  };
}
