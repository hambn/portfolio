// Expose React globally so the design components — which reference a bare
// `React` (e.g. `const { useState } = React`) — work unchanged after the
// build, instead of relying on Babel-in-browser like the original kit.
// Imported first in main.jsx, so it runs before any component module body.
import React from 'react';
import * as ReactDOM from 'react-dom/client';

window.React = React;
window.ReactDOM = ReactDOM;

// Absolute content base so runtime fetches resolve correctly from any route
// depth (deep links like /portfolio/blog are served via 404.html fallback).
window.CONTENT_BASE = import.meta.env.BASE_URL.replace(/\/+$/, '') + '/contents';
