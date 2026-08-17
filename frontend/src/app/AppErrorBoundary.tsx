import { Component, type ErrorInfo, type ReactNode } from "react";
import { IconAlertTriangle } from "@tabler/icons-react";

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Work Tools workspace failed to render", error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fatal-error">
          <IconAlertTriangle size={34} aria-hidden="true" />
          <h1>Work Tools encountered a problem</h1>
          <p>Your saved local data is unaffected. Reload the app to restore the workspace.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload Work Tools
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
