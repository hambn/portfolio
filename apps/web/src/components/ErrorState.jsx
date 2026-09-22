// ErrorState.jsx — inline failure notice with an optional retry action.
import React from 'react';

export default function ErrorState({ message = 'something went wrong.', onRetry }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--destructive)', fontSize: 'var(--text-sm)' }}>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--background-muted)',
            color: 'var(--foreground-muted)',
            border: '1px solid var(--border)',
          }}
        >
          retry
        </button>
      )}
    </div>
  );
}
