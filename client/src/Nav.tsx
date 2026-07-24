import { Menu } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

const links = [
  { label: "Product", to: "/product" },
  { label: "Reliability", to: "/reliability" },
  { label: "Playground", to: "/playground" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isDashboard = location.pathname === "/dashboard";

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-2 text-sm font-medium transition ${
      isActive
        ? "bg-blue-50 text-blue-700"
        : "text-zinc-500 hover:text-zinc-950"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <NavLink
          to="/"
          className="flex items-center gap-2.5 font-semibold tracking-tight uppercase"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-zinc-800 text-white shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 32 32"
            >
              <rect width="32" height="32" rx="6" fill="#000000" />
              <rect x="7" y="6" width="18" height="4" rx="2" fill="#eeeeee" />
              <rect x="7" y="14" width="18" height="4" rx="2" fill="#eeeeee" />
              <rect x="7" y="22" width="18" height="4" rx="2" fill="#2563EB" />
              <circle cx="24" cy="24" r="3" fill="#60A5FA" />
            </svg>
          </span>
          Aegis
        </NavLink>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
          <NavLink
            to="/dashboard"
            className="ml-2 inline-flex h-7 items-center rounded-lg bg-zinc-800 px-2.5 text-[0.8rem] font-medium text-white transition hover:bg-zinc-950"
          >
            Live dashboard
          </NavLink>
        </nav>

        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Open navigation"
                />
              }
            >
              <Menu className="size-4" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-white">
              <nav className="mt-10 flex flex-col gap-1">
                <NavLink
                  to="/"
                  onClick={() => setOpen(false)}
                  className={linkClass}
                >
                  Home
                </NavLink>
                {links.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className={linkClass}
                  >
                    {link.label}
                  </NavLink>
                ))}
                <NavLink
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                  className={`mt-2 rounded-md px-3 py-2 text-sm font-medium ${isDashboard ? "bg-blue-50 text-blue-700" : "text-zinc-500"}`}
                >
                  Live dashboard
                </NavLink>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
