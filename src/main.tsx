import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

/** 実行時エラーを白い画面の代わりに表示する（診断用） */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ASSET LEDGER] render error:", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", background: "#070b11", color: "#e8eef5", fontFamily: "IBM Plex Mono, monospace", padding: 40 }}>
          <p style={{ letterSpacing: "0.2em", color: "#f0616d", fontSize: 13 }}>RENDER ERROR ── 描画に失敗しました</p>
          <pre style={{ marginTop: 16, whiteSpace: "pre-wrap", fontSize: 12, color: "#92a5ba", lineHeight: 1.7 }}>
            {String(this.state.error)}
            {"\n"}
            {this.state.error?.stack ?? ""}
          </pre>
          <button
            onClick={() => location.reload()}
            style={{ marginTop: 24, padding: "10px 22px", background: "#e9b44c", color: "#070b11", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}
          >
            再読み込み
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
