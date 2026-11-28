// Terminal.jsx — floating, draggable, resizable, minimizable Unix shell with
// inline prompt inside the terminal stream, multi-window tmux (`Ctrl+b`), and
// distinct vi / vim / nvim viewers. Lazy-loaded via Keys.jsx (0 B until opened).
import './terminal.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PortfolioData } from '../lib/data.js';
import { currentRoute, navigate, routeHref } from '../lib/router.js';
import { cardSeed } from '../lib/siteFeed.js';
import {
  buildVirtualFs,
  completeInput,
  listDirectory,
  renderTree,
  resolveNode,
  routeToVfsPath,
  toPosixPath,
} from '../lib/terminalFs.js';
import { EXTERNAL } from '../lib/external.js';
import Icon from './Icon.jsx';
import { toggleTheme } from './Nav.jsx';
import VimViewer from './VimViewer.jsx';

const COMMANDS = [
  'help',
  'ls',
  'll',
  'la',
  'cd',
  'pwd',
  'tree',
  'cat',
  'vi',
  'vim',
  'nvim',
  'open',
  'tmux',
  'whoami',
  'neofetch',
  'fastfetch',
  'git',
  'history',
  'stack',
  'skills',
  'contact',
  'email',
  'theme',
  'uname',
  'echo',
  'date',
  'clear',
  'exit',
];

const SHA = import.meta.env.VITE_BUILD_SHA || '';
const BUILD_DATE = import.meta.env.VITE_BUILD_DATE || '';
const BASE_URL = import.meta.env.BASE_URL || '/';

const HELP_SECTIONS = [
  {
    title: 'filesystem',
    rows: [
      ['ls [-la|-las] [path]', 'list directory with item counts (dotfiles first)'],
      ['cd [path|..|-]', 'change directory (Documents/blogs, projects, ..)'],
      ['pwd / tree [path]', 'working directory or directory tree'],
      ['cat <file>', 'print full file contents'],
      ['vi / vim / nvim <file>', 'view file (each editor has its own style, :q exits)'],
      ['open <path>', 'open site route or external URL'],
    ],
  },
  {
    title: 'tmux (prefix: Ctrl+b)',
    rows: [
      ['Ctrl+b  [', 'copy / view mode (j/k, g/G, mouse scroll, q exits)'],
      ['Ctrl+b  c / x', 'create or close tmux window'],
      ['Ctrl+b  n / p / 0-9', 'switch tmux windows'],
      ['Ctrl+b  z / d', 'zoom (maximize) or detach (minimize to dock)'],
    ],
  },
  {
    title: 'profile & shell',
    rows: [
      ['whoami / neofetch', 'bio or system & live status summary'],
      ['git log / stack / contact', 'timeline, tools, or copy email'],
      ['theme [dark|light]', 'switch color theme'],
      ['clear / exit', 'clear screen (Ctrl+L) or close shell'],
    ],
  },
];

const MIN_W = 360;
const MIN_H = 260;

function initialRect() {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const w = Math.min(780, Math.max(MIN_W, vw - 32));
  const h = Math.min(450, Math.max(MIN_H, Math.round(vh * 0.54)));
  return {
    x: Math.max(16, Math.round((vw - w) / 2)),
    y: Math.max(64, vh - h - 20),
    w,
    h,
  };
}

function clampRect(next) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(vw - 16, Math.max(MIN_W, next.w));
  const h = Math.min(vh - 16, Math.max(MIN_H, next.h));
  const x = Math.min(Math.max(8, next.x), Math.max(8, vw - w - 8));
  const y = Math.min(Math.max(8, next.y), Math.max(8, vh - h - 8));
  return { x, y, w, h };
}

function tabNameFromPath(path) {
  if (!path || path === '~') return 'sh';
  return path.split('/').filter(Boolean).pop() || 'sh';
}

async function readFileContent(node) {
  if (node.slug) {
    try {
      const res = await fetch(`${BASE_URL}blog/${encodeURIComponent(node.slug)}.md`);
      if (res.ok) {
        const type = res.headers.get('content-type') || '';
        const text = await res.text();
        if (!type.includes('text/html') && text.trim()) return text.trimEnd();
      }
    } catch {}
  }
  return node.content || '';
}

function makeWindow(id, startCwd, withBanner = false) {
  return {
    id,
    cwd: startCwd,
    prevCwd: '~',
    entries: withBanner
      ? [
          {
            id: 0,
            text: "type 'help' for commands.",
          },
        ]
      : [],
    history: [],
    vimState: null,
  };
}

export default function Terminal({ minimized, onMinimize, onRestore, onClose }) {
  const nextWinId = useRef(1);
  const nextEntryId = useRef(1);
  const [windows, setWindows] = useState(() => [
    makeWindow(0, routeToVfsPath(currentRoute()), true),
  ]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [data, setData] = useState(null);
  const [input, setInput] = useState('');
  const [histIdx, setHistIdx] = useState(-1);
  const [maximized, setMaximized] = useState(false);
  const [rect, setRect] = useState(initialRect);
  const [tmuxPrefix, setTmuxPrefix] = useState(false);
  const [copyMode, setCopyMode] = useState(false);
  const [tmuxNotice, setTmuxNotice] = useState('');

  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const dragRef = useRef(null);
  const prefixTimer = useRef(null);
  const noticeTimer = useRef(null);

  const active = windows[activeIdx] || windows[0];
  const cwd = active.cwd;
  const vimState = active.vimState;

  const flashNotice = useCallback((msg) => {
    setTmuxNotice(msg);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setTmuxNotice(''), 2200);
  }, []);

  const updateActive = useCallback(
    (updater) => {
      setWindows((prev) => prev.map((win, idx) => (idx === activeIdx ? updater(win) : win)));
    },
    [activeIdx],
  );

  const push = useCallback(
    (entry) => {
      const id = nextEntryId.current++;
      updateActive((win) => ({ ...win, entries: [...win.entries, { id, ...entry }] }));
    },
    [updateActive],
  );

  const focusInput = useCallback(() => {
    window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      PortfolioData.getProfile().catch(() => ({})),
      PortfolioData.getResume().catch(() => ({})),
      PortfolioData.getLinks().catch(() => ({})),
      PortfolioData.getProjects().catch(() => ({})),
      PortfolioData.getBlogIndex().catch(() => []),
    ]).then(([profile, resume, links, projects, posts]) => {
      if (!alive) return;
      const liveFeed = cardSeed('projects');
      const liveProjects = liveFeed.status === 'ready' ? liveFeed.data?.sections || [] : [];
      setData({ profile, resume, links, projects, posts, liveProjects });
    });
    return () => {
      alive = false;
      clearTimeout(prefixTimer.current);
      clearTimeout(noticeTimer.current);
    };
  }, []);

  const fs = useMemo(
    () =>
      buildVirtualFs({
        ...(data || {}),
        origin: typeof window !== 'undefined' ? window.location.origin : 'https://hgh.dev',
      }),
    [data],
  );

  const suggestion = useMemo(() => {
    if (!input) return { replacement: null, ghost: '', candidates: [] };
    return completeInput(fs, cwd, input, COMMANDS);
  }, [fs, cwd, input]);

  useEffect(() => {
    const onResize = () => setRect((cur) => clampRect(cur));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onMove = (event) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (drag.mode === 'move') {
        setRect(clampRect({ ...drag.start, x: drag.start.x + dx, y: drag.start.y + dy }));
        return;
      }
      const next = { ...drag.start };
      if (drag.dir.includes('e')) next.w = drag.start.w + dx;
      if (drag.dir.includes('s')) next.h = drag.start.h + dy;
      if (drag.dir.includes('w')) {
        const clampedW = Math.max(MIN_W, drag.start.w - dx);
        next.x = drag.start.x + (drag.start.w - clampedW);
        next.w = clampedW;
      }
      if (drag.dir.includes('n')) {
        const clampedH = Math.max(MIN_H, drag.start.h - dy);
        next.y = drag.start.y + (drag.start.h - clampedH);
        next.h = clampedH;
      }
      setRect(clampRect(next));
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  useEffect(() => {
    if (copyMode) return;
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active.entries.length, activeIdx, vimState, copyMode]);

  useEffect(() => {
    if (minimized || vimState) return;
    if (copyMode) {
      bodyRef.current?.focus({ preventScroll: true });
      window.requestAnimationFrame(() => bodyRef.current?.focus({ preventScroll: true }));
    } else {
      focusInput();
    }
  }, [minimized, vimState, copyMode, activeIdx, focusInput]);

  const startDrag = (event) => {
    if (maximized || event.button !== 0 || event.target.closest('button')) return;
    dragRef.current = {
      mode: 'move',
      startX: event.clientX,
      startY: event.clientY,
      start: rect,
    };
    document.body.style.userSelect = 'none';
  };

  const startResize = (dir) => (event) => {
    if (maximized || event.button !== 0) return;
    event.stopPropagation();
    dragRef.current = {
      mode: 'resize',
      dir,
      startX: event.clientX,
      startY: event.clientY,
      start: rect,
    };
    document.body.style.userSelect = 'none';
  };

  const openFileInVim = async (editor, node, absPath) => {
    const content = await readFileContent(node);
    updateActive((win) => ({
      ...win,
      vimState: {
        editor,
        filePath: absPath,
        content,
        filetype: node.filetype || 'text',
        route: node.route,
        href: node.href,
      },
    }));
  };

  const closeActiveWindow = () => {
    if (windows.length <= 1) {
      onClose();
      return;
    }
    setWindows((prev) => prev.filter((_, i) => i !== activeIdx));
    setActiveIdx((i) => Math.max(0, i - 1));
    setCopyMode(false);
  };

  const createTmuxWindow = () => {
    const id = nextWinId.current++;
    setWindows((prev) => [...prev, makeWindow(id, cwd, false)]);
    setActiveIdx(windows.length);
    setCopyMode(false);
    setInput('');
    flashNotice(`new window ${windows.length}`);
  };

  const run = async (raw, overrideCwd) => {
    const activeCwd = overrideCwd || cwd;
    const line = raw.trim();
    if (!line) return;
    updateActive((win) => ({
      ...win,
      history: win.history[0] === line ? win.history : [line, ...win.history.slice(0, 49)],
    }));
    setHistIdx(-1);

    const tokens = line.split(/\s+/);
    let cmd = tokens[0].toLowerCase();
    let args = tokens.slice(1);
    if (cmd === 'cd..') {
      cmd = 'cd';
      args = ['..'];
    } else if (cmd === 'll') {
      cmd = 'ls';
      args = ['-la', ...args];
    } else if (cmd === 'la') {
      cmd = 'ls';
      args = ['-las', ...args];
    }
    const arg = args.join(' ').trim();

    if (cmd === 'clear') {
      updateActive((win) => ({ ...win, entries: [] }));
      focusInput();
      return;
    }
    if (cmd === 'exit' || cmd === 'quit') {
      closeActiveWindow();
      return;
    }
    if (cmd === 'help' || cmd === '?') {
      push({ prompt: activeCwd, cmd: line, kind: 'help' });
      focusInput();
      return;
    }
    if (cmd === 'tmux') {
      push({
        prompt: activeCwd,
        cmd: line,
        text: [
          `[hgh] ${windows.length} ${windows.length === 1 ? 'window' : 'windows'} active`,
          'prefix: Ctrl+b',
          '  [       copy / scroll view mode (j/k, g/G, mouse wheel, q exits)',
          '  c / x   new / close window',
          '  n / p   next / previous window (or 0-9)',
          '  z / d   zoom (maximize) / detach (minimize)',
        ].join('\n'),
      });
      focusInput();
      return;
    }
    if (cmd === 'pwd') {
      push({ prompt: activeCwd, cmd: line, text: toPosixPath(activeCwd, fs.handle) });
      focusInput();
      return;
    }
    if (cmd === 'date') {
      push({ prompt: activeCwd, cmd: line, text: new Date().toUTCString() });
      focusInput();
      return;
    }
    if (cmd === 'uname') {
      push({
        prompt: activeCwd,
        cmd: line,
        text: `Linux ${window.location.hostname} 6.12.0-hgh #1 SMP x86_64 GNU/Linux`,
      });
      focusInput();
      return;
    }
    if (cmd === 'echo') {
      push({ prompt: activeCwd, cmd: line, text: arg.replace(/^["']|["']$/g, '') });
      focusInput();
      return;
    }
    if (cmd === 'whoami') {
      const profile = data?.profile || (await PortfolioData.getProfile().catch(() => null));
      if (!profile) {
        push({ prompt: activeCwd, cmd: line, text: 'profile unavailable', error: true });
      } else {
        push({
          prompt: activeCwd,
          cmd: line,
          text: `${profile.name} (@${profile.handle})\n${profile.bio}`,
        });
      }
      focusInput();
      return;
    }
    if (cmd === 'neofetch' || cmd === 'fastfetch') {
      const profile = data?.profile || (await PortfolioData.getProfile().catch(() => ({})));
      const resume = data?.resume || (await PortfolioData.getResume().catch(() => ({})));
      const posts = data?.posts || (await PortfolioData.getBlogIndex().catch(() => []));
      const discord = cardSeed('discord');
      const presence = discord.status === 'ready' ? discord.data?.status : null;
      const theme = document.documentElement.getAttribute('data-theme') || 'dark';
      const lines = [
        `${profile.handle || 'hambn'}@${window.location.host}`,
        '────────────────────────',
        `shell    hgh-sh · tmux (${windows.length}w)`,
        `cwd      ${activeCwd}`,
        `stack    ${resume.skills?.length || 0} tools (${(resume.skills || []).slice(0, 5).join(', ')}, …)`,
        `blogs    ${posts.length} published`,
        `theme    ${theme}`,
        `build    ${SHA || 'dev'}${BUILD_DATE ? ` (${BUILD_DATE})` : ''}`,
        ...(presence ? [`discord  ${presence}`] : []),
        `utc      ${new Date().toISOString().slice(11, 16)}`,
      ];
      push({ prompt: activeCwd, cmd: line, text: lines.join('\n'), accent: true });
      focusInput();
      return;
    }
    if (cmd === 'theme') {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const target = arg.toLowerCase();
      if (target && target !== 'dark' && target !== 'light') {
        push({ prompt: activeCwd, cmd: line, text: 'usage: theme [dark|light]', error: true });
      } else {
        if (!target || target !== current) toggleTheme();
        const next = target || (current === 'light' ? 'dark' : 'light');
        push({ prompt: activeCwd, cmd: line, text: `theme -> ${next}` });
      }
      focusInput();
      return;
    }
    if (cmd === 'stack' || cmd === 'skills') {
      const resume = data?.resume || (await PortfolioData.getResume().catch(() => null));
      push({
        prompt: activeCwd,
        cmd: line,
        text: resume?.skills?.length ? resume.skills.join('  ') : 'no skills listed',
      });
      focusInput();
      return;
    }
    if (cmd === 'history' || (cmd === 'git' && args[0] === 'log')) {
      const resume = data?.resume || (await PortfolioData.getResume().catch(() => null));
      const branches = resume?.branches || [];
      if (!branches.length) {
        push({ prompt: activeCwd, cmd: line, text: 'no history available' });
      } else {
        const out = branches
          .map(
            (b) =>
              `* (${b.name})  ${b.start} – ${b.end}\n` +
              [...(b.commits || [])]
                .reverse()
                .map((c) => `  ${c.date.padEnd(9)} ${c.text}`)
                .join('\n'),
          )
          .join('\n\n');
        push({
          prompt: activeCwd,
          cmd: line,
          text: out,
          links: [{ label: 'open ~/Documents/resume', route: 'resume' }],
        });
      }
      focusInput();
      return;
    }
    if (cmd === 'contact' || cmd === 'email') {
      const links = data?.links || (await PortfolioData.getLinks().catch(() => null));
      const addr = links?.email?.address;
      if (!addr) {
        push({ prompt: activeCwd, cmd: line, text: 'no email configured', error: true });
      } else {
        let copied = false;
        try {
          await navigator.clipboard?.writeText(addr);
          copied = true;
        } catch {}
        push({
          prompt: activeCwd,
          cmd: line,
          text: `${addr}${copied ? '  (copied to clipboard)' : ''}`,
          links: [
            { label: 'open contact form', route: 'links' },
            { label: 'mailto', href: `mailto:${addr}` },
          ],
        });
      }
      focusInput();
      return;
    }
    if (cmd === 'tree') {
      const result = renderTree(fs, activeCwd, arg);
      push({
        prompt: activeCwd,
        cmd: line,
        text: result.ok ? result.text : result.error,
        error: !result.ok,
      });
      focusInput();
      return;
    }
    if (cmd === 'ls') {
      const result = listDirectory(fs, activeCwd, args);
      if (!result.ok) {
        push({ prompt: activeCwd, cmd: line, text: result.error, error: true });
      } else {
        push({ prompt: activeCwd, cmd: line, kind: 'ls', ls: result });
      }
      focusInput();
      return;
    }
    if (cmd === 'cd') {
      const target = !arg || arg === '~' ? '~' : arg === '-' ? active.prevCwd : arg;
      const resolved = resolveNode(fs, activeCwd, target);
      if (!resolved) {
        push({
          prompt: activeCwd,
          cmd: line,
          text: `cd: ${arg}: No such file or directory`,
          error: true,
        });
      } else if (resolved.node.kind !== 'dir') {
        push({ prompt: activeCwd, cmd: line, text: `cd: ${arg}: Not a directory`, error: true });
      } else {
        updateActive((win) => ({ ...win, prevCwd: activeCwd, cwd: resolved.path }));
        if (resolved.node.route) navigate(resolved.node.route);
        push({ prompt: activeCwd, cmd: line, text: arg === '-' ? resolved.path : '' });
      }
      focusInput();
      return;
    }
    if (cmd === 'cat') {
      if (!arg) {
        push({ prompt: activeCwd, cmd: line, text: 'usage: cat <file>', error: true });
      } else {
        const resolved = resolveNode(fs, activeCwd, arg);
        if (!resolved) {
          push({
            prompt: activeCwd,
            cmd: line,
            text: `cat: ${arg}: No such file or directory`,
            error: true,
          });
        } else if (resolved.node.kind === 'dir') {
          push({ prompt: activeCwd, cmd: line, text: `cat: ${arg}: Is a directory`, error: true });
        } else {
          const content = await readFileContent(resolved.node);
          push({ prompt: activeCwd, cmd: line, text: content });
        }
      }
      focusInput();
      return;
    }
    if (cmd === 'vi' || cmd === 'vim' || cmd === 'nvim') {
      if (!arg) {
        push({ prompt: activeCwd, cmd: line, text: `usage: ${cmd} <file>`, error: true });
        focusInput();
        return;
      }
      const resolved = resolveNode(fs, activeCwd, arg);
      if (!resolved) {
        push({
          prompt: activeCwd,
          cmd: line,
          text: `${cmd}: ${arg}: No such file or directory`,
          error: true,
        });
        focusInput();
        return;
      }
      if (resolved.node.kind === 'dir') {
        push({
          prompt: activeCwd,
          cmd: line,
          text: `${cmd}: ${arg}: Is a directory (use ls)`,
          error: true,
        });
        focusInput();
        return;
      }
      push({ prompt: activeCwd, cmd: line, text: '' });
      await openFileInVim(cmd, resolved.node, resolved.path);
      return;
    }
    if (cmd === 'open') {
      const resolved = resolveNode(fs, activeCwd, arg || '.');
      if (!resolved) {
        push({
          prompt: activeCwd,
          cmd: line,
          text: `open: ${arg}: No such file or directory`,
          error: true,
        });
      } else {
        const { node, path } = resolved;
        if (node.kind === 'link' && node.href) {
          window.open(node.href, '_blank', 'noopener,noreferrer');
          push({ prompt: activeCwd, cmd: line, text: `opened ${node.href}` });
        } else if (node.route) {
          navigate(node.route);
          push({ prompt: activeCwd, cmd: line, text: `opened ${path}` });
        } else if (node.href) {
          window.open(node.href, '_blank', 'noopener,noreferrer');
          push({ prompt: activeCwd, cmd: line, text: `opened ${node.href}` });
        } else {
          push({
            prompt: activeCwd,
            cmd: line,
            text: `open: ${path}: no web route associated`,
            error: true,
          });
        }
      }
      focusInput();
      return;
    }
    push({
      prompt: activeCwd,
      cmd: line,
      text: `${cmd}: command not found — type \`help\` for commands`,
      error: true,
    });
    focusInput();
  };

  const onEntryClick = (item) => {
    if (item.kind === 'dir') {
      updateActive((win) => ({ ...win, prevCwd: win.cwd, cwd: item.absPath }));
      if (item.route) navigate(item.route);
      void run(`ls ${item.absPath}`, item.absPath);
      return;
    }
    if (item.kind === 'link' && item.href) {
      window.open(item.href, '_blank', 'noopener,noreferrer');
      return;
    }
    const resolved = resolveNode(fs, cwd, item.absPath);
    if (resolved) void openFileInVim('nvim', resolved.node, resolved.path);
  };

  const applyAutocomplete = () => {
    const res = completeInput(fs, cwd, input, COMMANDS);
    if (res.replacement) {
      setInput(res.replacement);
      return;
    }
    if (res.candidates.length > 1) {
      push({ prompt: cwd, cmd: input, text: res.candidates.join('   ') });
    }
  };

  const handleTmuxKeyCapture = (event) => {
    // Arm Ctrl+b prefix from any active pane (shell, copy-mode, or vi/vim/nvim)
    if (event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      event.stopPropagation();
      setTmuxPrefix(true);
      clearTimeout(prefixTimer.current);
      prefixTimer.current = setTimeout(() => setTmuxPrefix(false), 3000);
      return;
    }
    if (!tmuxPrefix) return;
    event.preventDefault();
    event.stopPropagation();
    setTmuxPrefix(false);
    clearTimeout(prefixTimer.current);

    const k = event.key;
    if (k === '[') {
      if (vimState) updateActive((win) => ({ ...win, vimState: null }));
      setCopyMode(true);
      bodyRef.current?.focus({ preventScroll: true });
      flashNotice('');
    } else if (k === 'c') {
      createTmuxWindow();
    } else if (k === 'x') {
      closeActiveWindow();
    } else if (k === 'n') {
      setActiveIdx((i) => (i + 1) % windows.length);
      setCopyMode(false);
    } else if (k === 'p') {
      setActiveIdx((i) => (i - 1 + windows.length) % windows.length);
      setCopyMode(false);
    } else if (/^[0-9]$/.test(k)) {
      const idx = Number(k);
      if (idx < windows.length) {
        setActiveIdx(idx);
        setCopyMode(false);
      }
    } else if (k === 'z') {
      setMaximized((m) => !m);
      flashNotice(maximized ? 'unzoomed' : 'zoomed');
    } else if (k === 'd') {
      onMinimize();
    } else if (k === '?') {
      void run('tmux');
    } else {
      flashNotice(`unknown prefix key: ${k}`);
    }
  };

  const onCopyKeyDown = (event) => {
    const el = bodyRef.current;
    if (event.key === 'q' || event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setCopyMode(false);
      flashNotice('');
    } else if (event.key === 'j' || event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      el?.scrollBy({ top: 36 });
    } else if (event.key === 'k' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      el?.scrollBy({ top: -36 });
    } else if (event.key === 'PageDown' || (event.key === 'd' && event.ctrlKey)) {
      event.preventDefault();
      event.stopPropagation();
      el?.scrollBy({ top: (el.clientHeight || 300) * 0.6 });
    } else if (event.key === 'PageUp' || (event.key === 'u' && event.ctrlKey)) {
      event.preventDefault();
      event.stopPropagation();
      el?.scrollBy({ top: -(el.clientHeight || 300) * 0.6 });
    } else if (event.key === 'g') {
      event.preventDefault();
      event.stopPropagation();
      if (el) el.scrollTop = 0;
    } else if (event.key === 'G') {
      event.preventDefault();
      event.stopPropagation();
      if (el) el.scrollTop = el.scrollHeight;
    }
  };

  const onInputKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onMinimize();
    } else if (event.key === '`' && !input) {
      event.preventDefault();
      onMinimize();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const current = input;
      setInput('');
      void run(current);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      applyAutocomplete();
    } else if (
      event.key === 'ArrowRight' &&
      suggestion.ghost &&
      inputRef.current &&
      inputRef.current.selectionStart === input.length
    ) {
      event.preventDefault();
      setInput(`${input}${suggestion.ghost}`);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!active.history.length) return;
      const next = Math.min(active.history.length - 1, histIdx + 1);
      setHistIdx(next);
      setInput(active.history[next]);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (histIdx <= 0) {
        setHistIdx(-1);
        setInput('');
      } else {
        const next = histIdx - 1;
        setHistIdx(next);
        setInput(active.history[next]);
      }
    } else if (event.key === 'l' && event.ctrlKey) {
      event.preventDefault();
      updateActive((win) => ({ ...win, entries: [] }));
    }
  };

  if (minimized) {
    return (
      <div className="term-dock">
        <button
          type="button"
          className="term-dock-pill"
          onClick={onRestore}
          aria-label="restore terminal"
          title="Restore terminal (`)"
        >
          <Icon name="terminal" />
          <span>
            {fs.handle}@hgh.dev:{cwd}
          </span>
        </button>
        <button
          type="button"
          className="term-dock-close"
          onClick={onClose}
          aria-label="close terminal"
        >
          <Icon name="x" />
        </button>
      </div>
    );
  }

  const windowStyle = maximized
    ? undefined
    : {
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.w}px`,
        height: `${rect.h}px`,
      };

  return (
    <div
      className={`term-window${maximized ? ' is-max' : ''}`}
      style={windowStyle}
      role="dialog"
      aria-label="interactive terminal"
      onKeyDownCapture={handleTmuxKeyCapture}
      onKeyDown={copyMode ? onCopyKeyDown : undefined}
    >
      {!maximized &&
        ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map((dir) => (
          <div
            key={dir}
            className={`term-resize term-resize-${dir}`}
            onPointerDown={startResize(dir)}
            aria-hidden="true"
          />
        ))}

      <div
        className="term-bar"
        onPointerDown={startDrag}
        onDoubleClick={() => setMaximized((m) => !m)}
      >
        <span className="term-title">
          {fs.handle}@hgh.dev:{cwd}
        </span>
        <div className="term-bar-actions">
          <button
            type="button"
            className="term-bar-icon"
            onClick={onMinimize}
            aria-label="minimize terminal"
            title="Minimize (` or Ctrl+b d)"
          >
            <Icon name="minus" />
          </button>
          <button
            type="button"
            className="term-bar-icon"
            onClick={() => setMaximized((m) => !m)}
            aria-label={maximized ? 'restore window size' : 'maximize terminal'}
            title={maximized ? 'Restore' : 'Zoom (Ctrl+b z)'}
          >
            <Icon name="square" />
          </button>
          <button
            type="button"
            className="term-bar-icon term-bar-close"
            onClick={onClose}
            aria-label="close terminal"
            title="Close"
          >
            <Icon name="x" />
          </button>
        </div>
      </div>

      {vimState ? (
        <VimViewer
          editor={vimState.editor}
          filePath={vimState.filePath}
          content={vimState.content}
          filetype={vimState.filetype}
          onQuit={() => {
            updateActive((win) => ({ ...win, vimState: null }));
            focusInput();
          }}
          onOpen={
            vimState.route
              ? () => navigate(vimState.route)
              : vimState.href
                ? () => window.open(vimState.href, '_blank', 'noopener,noreferrer')
                : undefined
          }
        />
      ) : (
        <div
          className={`term-body${copyMode ? ' is-copy' : ''}`}
          ref={bodyRef}
          tabIndex={-1}
          onClick={() => {
            if (copyMode) {
              bodyRef.current?.focus({ preventScroll: true });
              return;
            }
            if (window.getSelection()?.toString()) return;
            inputRef.current?.focus({ preventScroll: true });
          }}
        >
          {active.entries.map((entry) => (
            <div key={entry.id} className="term-entry">
              {entry.cmd !== undefined && (
                <div className="term-cmd">
                  <span className="term-prompt">{entry.prompt} $</span>
                  <span>{entry.cmd}</span>
                </div>
              )}

              {entry.kind === 'help' ? (
                <div className="term-help">
                  {HELP_SECTIONS.map((sec) => (
                    <div key={sec.title} className="term-help-group">
                      <div className="term-help-heading">{sec.title}</div>
                      {sec.rows.map(([usage, desc]) => (
                        <div key={usage} className="term-help-row">
                          <span className="term-help-cmd">{usage}</span>
                          <span className="term-help-desc">{desc}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : entry.kind === 'ls' ? (
                <div className="term-ls">
                  {(entry.ls.flags.long || entry.ls.flags.size) && (
                    <div className="term-ls-total">
                      total {entry.ls.totalBlocks} · {entry.ls.targetPath}
                    </div>
                  )}
                  {entry.ls.flags.long ? (
                    <div className="term-ls-long">
                      {entry.ls.entries.map((item) => (
                        <div key={item.absPath + item.name} className="term-ls-row">
                          {entry.ls.flags.size && (
                            <span className="term-ls-blocks">
                              {String(item.blocks).padStart(3, ' ')}
                            </span>
                          )}
                          <span className="term-ls-perms">{item.perms}</span>
                          <span className="term-ls-links">
                            {String(item.links).padStart(2, ' ')}
                          </span>
                          <span className="term-ls-owner">{item.owner}</span>
                          <span className="term-ls-size">{item.sizeLabel.padStart(8, ' ')}</span>
                          <span className="term-ls-date">{item.date}</span>
                          <button
                            type="button"
                            className={`term-ls-name is-${item.kind}${item.hidden ? ' is-hidden' : ''}`}
                            onClick={() => onEntryClick(item)}
                            title={
                              item.kind === 'dir'
                                ? `${item.absPath} (${item.count} items)`
                                : `Open ${item.absPath}`
                            }
                          >
                            {item.name}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={`term-ls-grid${entry.ls.flags.one ? ' is-one' : ''}`}>
                      {entry.ls.entries.map((item) => (
                        <button
                          key={item.absPath + item.name}
                          type="button"
                          className={`term-ls-cell is-${item.kind}${item.hidden ? ' is-hidden' : ''}`}
                          onClick={() => onEntryClick(item)}
                          title={
                            item.kind === 'dir'
                              ? `${item.absPath} (${item.count} items)`
                              : `Open ${item.absPath} in nvim`
                          }
                        >
                          {entry.ls.flags.size && (
                            <span className="term-ls-blocks">{item.blocks} </span>
                          )}
                          <span>{item.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                entry.text && (
                  <pre
                    className={`term-out${entry.error ? ' is-error' : ''}${entry.accent ? ' is-accent' : ''}`}
                  >
                    {entry.text}
                  </pre>
                )
              )}

              {entry.links?.length > 0 && (
                <div className="term-links">
                  {entry.links.map((item) =>
                    item.route ? (
                      <button
                        key={item.label}
                        type="button"
                        className="term-link"
                        onClick={() => navigate(item.route)}
                      >
                        {item.label}
                      </button>
                    ) : (
                      <a
                        key={item.label}
                        href={item.href || routeHref('home')}
                        {...EXTERNAL}
                        className="term-link"
                      >
                        {item.label}
                      </a>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Live command prompt directly inside the terminal stream */}
          {!copyMode && (
            <label className="term-inline-prompt">
              <span className="term-prompt" aria-hidden="true">
                {cwd} $
              </span>
              <div className="term-input-wrap">
                <div className="term-mirror" aria-hidden="true">
                  <span className="term-mirror-typed">{input}</span>
                  {suggestion.ghost && (
                    <span className="term-mirror-ghost">{suggestion.ghost}</span>
                  )}
                </div>
                <input
                  ref={inputRef}
                  autoFocus
                  className="term-input"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={onInputKeyDown}
                  aria-label="terminal command"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
              </div>
            </label>
          )}
        </div>
      )}

      {/* Authentic flat tmux bottom statusline */}
      <div className="tmux-bar" aria-label="tmux status">
        <span className="tmux-session">[hgh]</span>
        <div className="tmux-windows">
          {windows.map((win, idx) => (
            <button
              key={win.id}
              type="button"
              className={`tmux-win${idx === activeIdx ? ' is-active' : ''}`}
              onClick={() => {
                setActiveIdx(idx);
                setCopyMode(false);
              }}
            >
              {idx}:{win.vimState ? win.vimState.editor : tabNameFromPath(win.cwd)}
              {idx === activeIdx ? '*' : ''}
            </button>
          ))}
          <button
            type="button"
            className="tmux-win tmux-win-add"
            onClick={createTmuxWindow}
            title="New tmux window (Ctrl+b c)"
            aria-label="new tmux window"
          >
            +
          </button>
        </div>
        <div className="tmux-right">
          {tmuxPrefix && <span className="tmux-prefix">^b</span>}
          {copyMode ? (
            <span className="tmux-copy">
              [copy] j/k g/G{' '}
              <button
                type="button"
                className="tmux-copy-exit"
                onClick={() => setCopyMode(false)}
                title="Exit copy mode (q)"
              >
                q
              </button>
            </span>
          ) : tmuxNotice ? (
            <span className="tmux-notice">{tmuxNotice}</span>
          ) : (
            <span className="tmux-host">{fs.handle}@hgh.dev</span>
          )}
        </div>
      </div>
    </div>
  );
}
