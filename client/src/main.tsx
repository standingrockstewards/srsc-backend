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

createRoot(document.getElementById("root")!).render(
<StrictMode>
<ErrorBoundary>
<App />
</ErrorBoundary>
</StrictMode>,
);
