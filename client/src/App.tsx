// at top of App.tsx, after your existing imports:
import { useState } from "react";
import Home from "./Home";
import Dashboard from "./Dashboard";
import Playground from "./Playground";

// change: export default function App() {
// to:     function Playground() {
// (keep the body exactly as-is)

// then add this at the bottom of the file:
export default function App() {
  const [view, setView] = useState<"home" | "dashboard" | "playground">("home");

  return (
    <div>
      <nav className="flex gap-4 border-b border-zinc-200 px-6 py-3 text-sm dark:border-zinc-800">
        <button
          onClick={() => setView("home")}
          className={view === "home" ? "font-semibold" : "text-zinc-500"}
        >
          Home
        </button>
        <button
          onClick={() => setView("dashboard")}
          className={view === "dashboard" ? "font-semibold" : "text-zinc-500"}
        >
          Dashboard
        </button>
        <button
          onClick={() => setView("playground")}
          className={view === "playground" ? "font-semibold" : "text-zinc-500"}
        >
          Playground
        </button>
      </nav>
      {view === "home" && <Home onNavigate={setView} />}
      {view === "dashboard" && <Dashboard />}
      {view === "playground" && <Playground />}
    </div>
  );
}
