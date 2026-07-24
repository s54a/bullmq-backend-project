import { useState } from "react";
import Home from "./Home";
import Dashboard from "./Dashboard";
import Playground from "./Playground";
import Nav from "./Nav";

export default function App() {
  const [view, setView] = useState<"home" | "dashboard" | "playground">("home");

  return (
    <div>
      <Nav view={view} onNavigate={setView} />
      {view === "home" && <Home onNavigate={setView} />}
      {view === "dashboard" && <Dashboard />}
      {view === "playground" && <Playground />}
    </div>
  );
}
