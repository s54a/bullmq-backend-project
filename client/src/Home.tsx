import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function Home({
  onNavigate,
}: {
  onNavigate: (v: "dashboard" | "playground") => void;
}) {
  return (
    <div className="bg-white dark:bg-zinc-950">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_-10%,rgba(24,24,27,0.06),transparent_50%)] dark:bg-[radial-gradient(circle_at_20%_-10%,rgba(255,255,255,0.06),transparent_50%)]" />
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <Badge variant="secondary" className="mb-5">
            Backend Developer Track · OneInbox Hackathon
          </Badge>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            One gateway. Every LLM provider.
            <br />
            <span className="text-zinc-400 dark:text-zinc-500">
              Zero dropped requests.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base text-zinc-500 sm:text-lg dark:text-zinc-400">
            Aegis is a multi-tenant API gateway that sits in front of OpenAI,
            Groq, and Anthropic. Every tenant gets an independent rate-limit
            budget, bursts get queued instead of rejected, and a dead provider
            fails over automatically.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" onClick={() => onNavigate("dashboard")}>
              View live dashboard
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => onNavigate("playground")}
            >
              Try the API →
            </Button>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-6 border-t border-zinc-200 pt-8 sm:grid-cols-4 dark:border-zinc-800">
            {[
              ["3", "providers routed"],
              ["<50ms", "gateway overhead p99"],
              ["1,000+", "req/sec supported"],
              ["0", "requests dropped"],
            ].map(([stat, label]) => (
              <div key={label}>
                <p className="text-2xl font-semibold sm:text-3xl">{stat}</p>
                <p className="text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-400 uppercase">
          Built for
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            [
              "SaaS developers",
              "Integrating LLMs into a product that needs per-customer usage control, without building rate limiting from scratch.",
            ],
            [
              "Platform engineers",
              "Managing infra cost and provider reliability across multiple LLM vendors at once.",
            ],
            [
              "Finance & ops",
              "Tracking per-tenant token usage for cost allocation and billing, from real usage logs.",
            ],
          ].map(([title, desc]) => (
            <Card key={title}>
              <CardContent className="p-5">
                <p className="font-medium">{title}</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  {desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="mx-auto max-w-6xl" />

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-400 uppercase">
          How a request flows through it
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-3">
          {[
            [
              "Tenant auth",
              "Request arrives with an X-Gateway-Key, resolved to a tenant record in Postgres.",
            ],
            [
              "Rate limit check",
              "A Redis token bucket checks both requests/min and tokens/min for that tenant, atomically.",
            ],
            [
              "Under limit → direct call",
              "Proxied straight to the provider, with circuit-breaker failover if it's down.",
            ],
            [
              "Over limit → queued",
              "Pushed into a BullMQ priority queue instead of a 429 — high-priority tenants jump the line.",
            ],
            [
              "Worker drains queue",
              "Background workers process queued jobs once the tenant's bucket refills.",
            ],
          ].map(([title, desc], i) => (
            <Card key={title}>
              <CardContent className="flex gap-4 p-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {desc}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            [
              "Per-tenant limits",
              "RPM + TPM enforced independently, per tenant, via Redis token buckets.",
            ],
            [
              "Zero-drop queueing",
              "Bursts don't get rejected — they queue with priority instead of a 429.",
            ],
            [
              "Automatic failover",
              "A circuit breaker trips off a failing provider and reroutes traffic live.",
            ],
          ].map(([title, desc]) => (
            <Card key={title}>
              <CardContent className="p-5">
                <p className="font-medium">{title}</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  {desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-zinc-200 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
        Aegis AI Gateway — built for the OneInbox Backend Developer track.
      </footer>
    </div>
  );
}
