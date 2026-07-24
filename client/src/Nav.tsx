import { Menu, ShieldCheck } from "lucide-react";
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
        <NavLink to="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <ShieldCheck className="size-4" />
          </span>
          Aegis
        </NavLink>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
          <NavLink to="/dashboard" className="ml-2 inline-flex h-7 items-center rounded-lg bg-blue-600 px-2.5 text-[0.8rem] font-medium text-white transition hover:bg-blue-700">Live dashboard</NavLink>
        </nav>

        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="outline" size="icon" aria-label="Open navigation" />}>
              <Menu className="size-4" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-white">
              <nav className="mt-10 flex flex-col gap-1">
                <NavLink to="/" onClick={() => setOpen(false)} className={linkClass}>
                  Home
                </NavLink>
                {links.map((link) => (
                  <NavLink key={link.to} to={link.to} onClick={() => setOpen(false)} className={linkClass}>
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
