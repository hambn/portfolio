// Keeps a render error inside the subtree that threw it. Without a boundary
// React unmounts the whole root, so one malformed provider field would blank
// the page, navigation included. Changing resetKey clears the error.
import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, resetKey: props.resetKey };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(props, state) {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
