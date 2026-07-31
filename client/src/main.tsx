import { StrictMode, Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

interface EBState { error: Error | null; }
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("App crashed:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "monospace", whiteSpace: "pre-wrap", color: "#b00020" }}>
          <h1>App failed to load</h1>
          <p>{String(this.state.error?.message)}</p>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function renderFatal(err: unknown) {
  const el = document.getElementById("root");
  if (!el) return;
  const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
  el.innerHTML =
    '<div style="padding:24px;font-family:monospace;white-space:pre-wrap;color:#b00020">' +
    "<h1>App failed to load</h1><pre>" +
    message.replace(/</g, "&lt;") +
    "</pre></div>";
}

window.addEventListener("error", (e) => { console.error("window.error:", e.error ?? e.message); });
window.addEventListener("unhandledrejection", (e) => { console.error("unhandledrejection:", e.reason); });

try {
  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error('Root element "#root" not found in index.html');
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
} catch (err) {
  console.error("Fatal bootstrap error:", err);
  renderFatal(err);
}
