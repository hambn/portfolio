// ErrorState.jsx — inline failure notice with an optional retry action.
// Styled in styles/core.css (.error-state), not with style objects.
import React from 'react';

export default function ErrorState({ message = 'something went wrong.', onRetry }) {
  return (
    <div className="error-state">
      <span className="error-state-message">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="error-state-retry">
          retry
        </button>
      )}
    </div>
  );
}
