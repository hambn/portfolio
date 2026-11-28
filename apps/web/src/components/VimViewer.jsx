// VimViewer.jsx — distinct read-only vi, vim, and nvim viewers inside Terminal.jsx:
//   vi   -> classic POSIX vi: bare monochrome, no line numbers, minimal bottom line
//   vim  -> classic Vim 9: absolute line numbers, syntax colors, solid inverted bar
//   nvim -> modern Neovim: relative line numbers, rich syntax, lualine segmented bar
import React, { useEffect, useMemo, useRef, useState } from 'react';

function classifyLine(line, filetype) {
  if (filetype === 'markdown') {
    if (/^#{1,6}\s/.test(line)) return 'is-heading';
    if (/^```/.test(line)) return 'is-fence';
    if (/^>\s/.test(line)) return 'is-quote';
    if (/^\s*[-*]\s/.test(line)) return 'is-list';
  } else if (filetype === 'sh') {
    if (/^\s*#/.test(line)) return 'is-comment';
    if (/^\s*(export|alias)\s/.test(line)) return 'is-heading';
  } else if (filetype === 'ini') {
    if (/^\[.+\]$/.test(line)) return 'is-heading';
    if (/^\s*#/.test(line)) return 'is-comment';
  }
  return '';
}

export default function VimViewer({
  editor,
  filePath,
  content,
  filetype = 'text',
  onQuit,
  onOpen,
}) {
  const variant = editor === 'vi' ? 'vi' : editor === 'vim' ? 'vim' : 'nvim';
  const lines = useMemo(() => {
    const raw = String(content || '').replace(/\r\n/g, '\n');
    const arr = raw.split('\n');
    return arr.length ? arr : [''];
  }, [content]);

  const [cursor, setCursor] = useState(0);
  const [mode, setMode] = useState('normal');
  const [cmdline, setCmdline] = useState('');
  const [message, setMessage] = useState(
    variant === 'vi'
      ? `"${filePath}" [Read only] line 1 of ${lines.length}`
      : `"${filePath}" [readonly] ${lines.length}L`,
  );
  const [searchTerm, setSearchTerm] = useState('');
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const cmdRef = useRef(null);
  const pendingG = useRef(false);

  useEffect(() => {
    if (mode === 'normal') rootRef.current?.focus({ preventScroll: true });
    else cmdRef.current?.focus({ preventScroll: true });
  }, [mode]);

  useEffect(() => {
    const row = listRef.current?.querySelector(`[data-line="${cursor}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const matches = useMemo(() => {
    if (!searchTerm) return [];
    const needle = searchTerm.toLowerCase();
    const hits = [];
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes(needle)) hits.push(idx);
    });
    return hits;
  }, [lines, searchTerm]);

  const jumpMatch = (dir) => {
    if (!matches.length) {
      setMessage(`E486: Pattern not found: ${searchTerm}`);
      return;
    }
    const next =
      dir > 0
        ? (matches.find((i) => i > cursor) ?? matches[0])
        : ([...matches].reverse().find((i) => i < cursor) ?? matches[matches.length - 1]);
    setCursor(next);
    setMessage(`/${searchTerm}  [${matches.indexOf(next) + 1}/${matches.length}]`);
  };

  const runExCommand = (raw) => {
    const cmd = raw.trim();
    setMode('normal');
    setCmdline('');
    if (!cmd) return;
    if (/^(q|q!|qa|qa!|wq|wq!|x|exit)$/.test(cmd)) {
      onQuit();
      return;
    }
    if (/^\d+$/.test(cmd)) {
      const target = Math.max(0, Math.min(lines.length - 1, Number(cmd) - 1));
      setCursor(target);
      setMessage(`line ${target + 1}`);
      return;
    }
    if (cmd === 'open' || cmd === 'o') {
      if (onOpen) {
        onOpen();
        setMessage(`opened ${filePath}`);
      } else {
        setMessage('No site route linked to this file');
      }
      return;
    }
    if (cmd === 'help' || cmd === 'h') {
      setMessage('j/k move · gg/G top/end · /search (n/N) · :<num> · :open · :q quit');
      return;
    }
    if (cmd === 'w' || cmd === 'w!') {
      setMessage("E45: 'readonly' option is set");
      return;
    }
    setMessage(`E492: Not an editor command: ${cmd}`);
  };

  const onNormalKeyDown = (event) => {
    if (mode !== 'normal') return;
    const key = event.key;

    if (key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      pendingG.current = false;
      setMessage(variant === 'vi' ? 'type :q to quit' : 'NORMAL — type :q to quit');
      return;
    }
    if (key === 'j' || key === 'ArrowDown') {
      event.preventDefault();
      pendingG.current = false;
      setCursor((c) => Math.min(lines.length - 1, c + 1));
      return;
    }
    if (key === 'k' || key === 'ArrowUp') {
      event.preventDefault();
      pendingG.current = false;
      setCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (key === 'PageDown' || (key === 'd' && event.ctrlKey)) {
      event.preventDefault();
      pendingG.current = false;
      setCursor((c) => Math.min(lines.length - 1, c + 10));
      return;
    }
    if (key === 'PageUp' || (key === 'u' && event.ctrlKey)) {
      event.preventDefault();
      pendingG.current = false;
      setCursor((c) => Math.max(0, c - 10));
      return;
    }
    if (key === 'G' || key === 'End') {
      event.preventDefault();
      pendingG.current = false;
      setCursor(lines.length - 1);
      return;
    }
    if (key === 'Home') {
      event.preventDefault();
      pendingG.current = false;
      setCursor(0);
      return;
    }
    if (key === 'g') {
      event.preventDefault();
      if (pendingG.current) {
        pendingG.current = false;
        setCursor(0);
      } else {
        pendingG.current = true;
      }
      return;
    }
    pendingG.current = false;

    if (key === ':') {
      event.preventDefault();
      event.stopPropagation();
      setMode('command');
      setCmdline('');
      return;
    }
    if (key === '/') {
      event.preventDefault();
      event.stopPropagation();
      setMode('search');
      setCmdline('');
      return;
    }
    if (key === 'n' && searchTerm) {
      event.preventDefault();
      jumpMatch(1);
      return;
    }
    if (key === 'N' && searchTerm) {
      event.preventDefault();
      jumpMatch(-1);
      return;
    }
    if (key === 'q') {
      event.preventDefault();
      setMessage('Use :q to exit');
      return;
    }
    if (
      ['i', 'a', 'o', 'O', 'x', 'c', 's', 'r'].includes(key) &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      setMessage("-- READONLY -- E45: 'readonly' option is set (use :q to quit)");
    }
  };

  const onCmdKeyDown = (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      setMode('normal');
      setCmdline('');
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (mode === 'command') {
        runExCommand(cmdline);
      } else if (mode === 'search') {
        const term = cmdline;
        setMode('normal');
        setCmdline('');
        setSearchTerm(term);
        if (!term) return;
        const needle = term.toLowerCase();
        const hit = lines.findIndex((l, i) => i >= cursor && l.toLowerCase().includes(needle));
        const finalHit = hit >= 0 ? hit : lines.findIndex((l) => l.toLowerCase().includes(needle));
        if (finalHit >= 0) {
          setCursor(finalHit);
          setMessage(`/${term}`);
        } else {
          setMessage(`E486: Pattern not found: ${term}`);
        }
      }
    }
  };

  const pct =
    lines.length <= 1
      ? 'All'
      : cursor === 0
        ? 'Top'
        : cursor === lines.length - 1
          ? 'Bot'
          : `${Math.round(((cursor + 1) / lines.length) * 100)}%`;

  const gutterWidth = Math.max(2, String(lines.length).length);
  const showLineNumbers = variant !== 'vi';
  const showSyntax = variant !== 'vi';

  return (
    <div
      className={`vim-root vim-style-${variant}`}
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onNormalKeyDown}
      role="region"
      aria-label={`${editor} viewing ${filePath}`}
    >
      <div className="vim-buffer" ref={listRef}>
        {lines.map((line, index) => {
          const isCur = index === cursor;
          const isHit = searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase());
          const kindClass = showSyntax ? classifyLine(line, filetype) : '';
          const lineNum =
            variant === 'nvim' ? (isCur ? index + 1 : Math.abs(index - cursor)) : index + 1;
          return (
            <div
              key={index}
              data-line={index}
              className={`vim-line${isCur ? ' is-current' : ''}${isHit ? ' is-match' : ''}`}
              onClick={() => {
                setCursor(index);
                rootRef.current?.focus({ preventScroll: true });
              }}
            >
              {showLineNumbers && (
                <span className="vim-ln" style={{ minWidth: `${gutterWidth + 1}ch` }}>
                  {lineNum}
                </span>
              )}
              <span className={`vim-code${kindClass ? ` ${kindClass}` : ''}`}>{line || ' '}</span>
            </div>
          );
        })}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`tilde-${i}`} className="vim-line vim-tilde" aria-hidden="true">
            <span
              className="vim-ln"
              style={{ minWidth: showLineNumbers ? `${gutterWidth + 1}ch` : '2ch' }}
            >
              ~
            </span>
            <span className="vim-code" />
          </div>
        ))}
      </div>

      {variant === 'nvim' && (
        <div className="vim-status is-nvim">
          <span className="vim-mode">
            {mode === 'normal' ? 'NORMAL' : mode === 'command' ? 'COMMAND' : 'SEARCH'}
          </span>
          <span className="vim-branch">main</span>
          <span className="vim-file">{filePath} [RO]</span>
          <span className="vim-meta">
            {filetype} · utf-8 · {cursor + 1}/{lines.length} · {pct}
          </span>
          {onOpen && (
            <button type="button" className="vim-action" onClick={onOpen} title="Open page">
              :open
            </button>
          )}
          <button type="button" className="vim-action" onClick={onQuit} title="Quit (:q)">
            :q
          </button>
        </div>
      )}

      {variant === 'vim' && (
        <div className="vim-status is-vim">
          <span className="vim-file">{filePath} [RO]</span>
          <span className="vim-meta">
            {cursor + 1},1 · {pct}
          </span>
          <button type="button" className="vim-action" onClick={onQuit} title="Quit (:q)">
            :q
          </button>
        </div>
      )}

      <div className="vim-cmdbar">
        {mode === 'normal' ? (
          <span className="vim-msg">
            {variant === 'vim' ? `-- NORMAL --  ${message}` : message}
            {variant === 'vi' && (
              <button type="button" className="vim-inline-q" onClick={onQuit}>
                [:q]
              </button>
            )}
          </span>
        ) : (
          <label className="vim-cmd-input-wrap">
            <span className="vim-cmd-sigil">{mode === 'command' ? ':' : '/'}</span>
            <input
              ref={cmdRef}
              className="vim-cmd-input"
              value={cmdline}
              onChange={(event) => setCmdline(event.target.value)}
              onKeyDown={onCmdKeyDown}
              aria-label={mode === 'command' ? 'vim command' : 'vim search'}
              autoComplete="off"
              spellCheck="false"
            />
          </label>
        )}
      </div>
    </div>
  );
}
