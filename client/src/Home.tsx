import { ArrowRight, Clock3, ShieldCheck, Sparkles, Waypoints } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const benefits = [
  { icon: ShieldCheck, title: "Tenant isolation", text: "Independent RPM and estimated TPM budgets keep one customer’s burst from consuming everyone else’s capacity." },
  { icon: Clock3, title: "Burst absorption", text: "Over-limit requests receive a trackable 202 job instead of an abrupt rejection at the gateway." },
  { icon: Waypoints, title: "Provider resilience", text: "Groq is the primary route; Aegis can fall back to OpenAI when the primary provider fails." },
];

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-zinc-100 bg-[radial-gradient(circle_at_82%_8%,rgba(59,130,246,.15),transparent_26%),radial-gradient(circle_at_15%_0%,rgba(219,234,254,.7),transparent_30%)]">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-18 sm:px-6 lg:grid-cols-[1fr_.96fr] lg:items-center lg:py-24">
          <div>
            <Badge className="border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-50">Multi-tenant AI reliability infrastructure</Badge>
            <h1 className="mt-5 max-w-xl text-4xl font-semibold tracking-[-0.045em] text-zinc-950 sm:text-5xl lg:text-6xl">
              Keep every AI request moving.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg">
              Aegis gives each tenant its own rate-limit budget, queues bursts instead of rejecting users, and fails over when a provider is unavailable.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/dashboard" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700">Explore live dashboard <ArrowRight className="size-4" /></Link>
              <Link to="/playground" className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 px-3 text-sm font-medium transition hover:bg-zinc-50">Try the API playground</Link>
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm text-zinc-500"><Sparkles className="size-4 text-blue-600" /> Designed for SaaS teams operating AI features at scale.</p>
          </div>
          <RequestFlow />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-blue-600">WHY AEGIS EXISTS</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Upstream limits should not become your customers’ failed requests.</h2>
          <p className="mt-4 leading-7 text-zinc-600">Aegis sits between your product and model providers, turning shared upstream capacity into a controlled, observable experience for every tenant.</p>
        </div>
        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {benefits.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="border-zinc-200 shadow-none">
              <CardContent className="p-6">
                <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon className="size-5" /></span>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <p className="text-center text-sm font-semibold tracking-wide text-zinc-500 uppercase">Load-test evidence</p>
          <div className="mt-8 grid grid-cols-2 divide-x divide-y divide-zinc-200 border border-zinc-200 bg-white sm:grid-cols-4 sm:divide-y-0">
            {[["50", "maximum virtual users"], ["10,581", "requests accepted"], ["0", "HTTP errors"], ["256.72 ms", "p95 gateway response"]].map(([value, label]) => (
              <div key={label} className="px-5 py-6 text-center">
                <p className="text-2xl font-semibold tracking-tight text-zinc-950">{value}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center"><Link to="/reliability" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700">See the test methodology <ArrowRight className="size-4" /></Link></div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl bg-zinc-950 px-6 py-10 text-white sm:px-10">
          <p className="text-sm font-semibold text-blue-300">BUILT FOR AI SAAS TEAMS</p>
          <div className="mt-3 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div><h2 className="text-3xl font-semibold tracking-tight">Make provider limits feel invisible to your customers.</h2><p className="mt-3 max-w-2xl text-zinc-300">Provision tenant budgets, observe queues, and demonstrate the request lifecycle without building reliability plumbing from scratch.</p></div>
            <Link to="/product" className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-white px-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100">How Aegis works</Link>
          </div>
        </div>
      </section>
    </>
  );
}

function RequestFlow() {
  const lanes = [
    ["Tenant A", "served now", "bg-emerald-500", "border-emerald-200 bg-emerald-50 text-emerald-700"],
    ["Tenant B", "queued", "bg-amber-500", "border-amber-200 bg-amber-50 text-amber-700"],
    ["Tenant C", "rerouted", "bg-blue-500", "border-blue-200 bg-blue-50 text-blue-700"],
  ];
  return <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl shadow-blue-950/5 sm:p-6">
    <div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Live request flow</p><p className="mt-1 text-xs text-zinc-500">Every tenant gets an independent lane.</p></div><span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgb(220_252_231)]" /></div>
    <div className="mt-6 space-y-3">
      {lanes.map(([tenant, status, dot, tone]) => <div key={tenant} className="grid grid-cols-[1fr_20px_1.15fr] items-center gap-2 sm:grid-cols-[1fr_44px_1.2fr]">
        <div className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium">{tenant}</div><div className="relative h-px bg-zinc-300 after:absolute after:right-0 after:top-1/2 after:size-1.5 after:-translate-y-1/2 after:rotate-45 after:border-t after:border-r after:border-zinc-400" />
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${tone}`}><span className={`size-1.5 rounded-full ${dot}`} />{status}</div>
      </div>)}</div>
    <div className="mt-5 grid grid-cols-[1fr_20px_1fr] items-center gap-2 border-t border-zinc-100 pt-5 sm:grid-cols-[1fr_44px_1fr]"><div className="rounded-lg bg-zinc-950 px-3 py-3 text-sm font-semibold text-white">Aegis Gateway</div><div className="h-px bg-zinc-300" /><div className="space-y-2"><div className="rounded-md border border-zinc-200 px-3 py-2 text-xs">Groq <span className="float-right text-emerald-600">primary</span></div><div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">OpenAI <span className="float-right">fallback</span></div></div></div>
  </div>;
}
