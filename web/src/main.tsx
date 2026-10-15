import { createRoot } from "react-dom/client";
import { Component, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { loadRuntime } from "./config";
import { RuntimeContext } from "./data";
import { App } from "./App";
import { Town } from "./Town";
import "./style.css";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="page">
        <h1>Weir could not load this view</h1>
        <p>Your wallet has not been asked to sign. Reload to try again.</p>
        <button onClick={() => location.reload()}>Reload Weir</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
const root = createRoot(document.getElementById("root")!);
// First paint: the town itself, before the deployment file and wallet runtime arrive.
const firstPaint = (location.hash.slice(1) || "/") === "/";
if (firstPaint)
  root.render(
    <main id="main" className="page home" tabIndex={-1}>
      <Town staticShell />
    </main>,
  );
loadRuntime()
  .then((runtime) => {
    const query = new QueryClient({
      defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
    });
    root.render(
      <ErrorBoundary>
        <RuntimeContext.Provider value={runtime}>
          <WagmiProvider config={runtime.wallet}>
            <QueryClientProvider client={query}>
              <App />
            </QueryClientProvider>
          </WagmiProvider>
        </RuntimeContext.Provider>
      </ErrorBoundary>,
    );
  })
  .catch((error) =>
    root.render(
      <main className={`page${firstPaint ? " home" : ""}`}>
        {firstPaint && <Town staticShell />}
        <div className="page-inner">
        <h1>Deployment could not be verified</h1>
        <p role="alert">
          {error instanceof Error
            ? error.message
            : "Unable to read the deployment configuration."}
        </p>
        <p>
          Transactions are disabled until the deployment and ABI files can be
          loaded.
        </p>
        <button onClick={() => location.reload()}>Reload Weir</button>
        </div>
      </main>,
    ),
  );
