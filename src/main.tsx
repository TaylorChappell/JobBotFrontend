import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { App } from "@/app";
import "@/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider attribute="class" forcedTheme="light">
      <App />
    </ThemeProvider>
  </StrictMode>,
);
