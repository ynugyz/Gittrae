import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./app/styles.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { message: string }
> {
  state = { message: "" };
  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }
  render() {
    return this.state.message ? (
      <main className="fatal">
        <h1>页面遇到问题</h1>
        <p role="alert">{this.state.message}</p>
        <p>请刷新页面后重新导入已保存的项目。</p>
        <button onClick={() => location.reload()}>重新打开</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
