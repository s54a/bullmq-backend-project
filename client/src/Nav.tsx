import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

type View = "home" | "dashboard" | "playground";

const links: { label: string; value: View }[] = [
  { label: "Home", value: "home" },
  { label: "Dashboard", value: "dashboard" },
  { label: "Playground", value: "playground" },
];

export default function Nav({
  view,
  onNavigate,
}: {
  view: View;
  onNavigate: (v: View) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <button
          onClick={() => onNavigate("home")}
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-sm font-bold text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900">
            A
          </span>
          Aegis Gateway
        </button>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <button
              key={l.value}
              onClick={() => onNavigate(l.value)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                view === l.value
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              }`}
            >
              {l.label}
            </button>
          ))}
          <Button
            size="sm"
            className="ml-2"
            onClick={() => onNavigate("dashboard")}
          >
            Live Dashboard
          </Button>
        </nav>

        {/* Mobile nav */}
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <nav className="mt-10 flex flex-col gap-2">
                {links.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => {
                      onNavigate(l.value);
                      setOpen(false);
                    }}
                    className={`rounded-md px-3 py-2 text-left text-sm font-medium ${
                      view === l.value
                        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
                        : "text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function MenuIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}
