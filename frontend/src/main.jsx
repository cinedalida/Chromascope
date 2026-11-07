import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/variables.css";
import "./styles/globals.css";
import "./styles/components.css";
import App from "./App.jsx";
import { registerSW } from "virtual:pwa-register";

// Service worker (production builds only; the plugin registers nothing in dev). No automatic
// reload: a waiting update stays waiting until the Phase 3 prompt lets the user reload.
registerSW({ immediate: true });

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
