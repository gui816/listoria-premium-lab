import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { supabase } from "./lib/supabase.js";
import { completeAuthCallback } from "./lib/auth-callback.js";
import "./styles.css";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Listora failed to render:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ minHeight: "100vh", boxSizing: "border-box", display: "grid", placeItems: "center", padding: 24, background: "#f5f6ef", color: "#252a24", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
          <section style={{ maxWidth: 360 }}>
            <h1 style={{ fontSize: 28 }}>Listora</h1>
            <p>Something went wrong while opening the app.</p>
            <p>Please close and reopen the app. If the problem continues, update to the latest version.</p>
            <button style={{ padding: "12px 20px", borderRadius: 12, border: 0, background: "#456c4c", color: "white", fontSize: 16 }} onClick={() => window.location.reload()}>Try again</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
      console.warn("Listora offline support could not be enabled:", error);
    });
  });
}

async function mountListora() {
  try {
    await completeAuthCallback({
      supabase,
      location: window.location,
      history: window.history,
      storage: window.sessionStorage
    });
  } catch (error) {
    try { window.sessionStorage.setItem("listora-auth-callback-error", error?.message || "Não foi possível concluir o login."); } catch {}
    console.error("Listora auth callback failed:", error);
  }

  createRoot(document.getElementById("root")).render(
    <React.StrictMode><AppErrorBoundary><App /></AppErrorBoundary></React.StrictMode>
  );
}

void mountListora();
