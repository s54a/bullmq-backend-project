export default function Home({
  onNavigate,
}: {
  onNavigate: (v: "dashboard" | "playground") => void;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <header className="mb-12 flex flex-col gap-3">
          <span className="w-fit rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900">
            Aegis AI Gateway
          </span>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            A rate-limited, multi-tenant gateway for LLM providers
          </h1>
          <p className="max-w-2xl text-zinc-500 dark:text-zinc-400">
            Every tenant gets its own request/token quota. When a tenant bursts
            past their limit, requests are queued by priority instead of
            dropped. If a provider (Groq) goes down, traffic fails over
            automatically instead of erroring out.
          </p>
          <div className="mt-2 flex gap-3">
            <button
              onClick={() => onNavigate("dashboard")}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              View live dashboard
            </button>
            <button
              onClick={() => onNavigate("playground")}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              Try the API
            </button>
          </div>
        </header>

        <section className="mb-12">
          <h2 className="mb-4 text-sm font-semibold tracking-wide text-zinc-400 uppercase">
            How a request flows through it
          </h2>
          <ol className="flex flex-col gap-3">
            {[
              [
                "Tenant auth",
                "Request comes in with an X-Gateway-Key, resolved to a tenant record in Postgres.",
              ],
              [
                "Rate limit check",
                "Redis-backed token bucket checks both requests/min and tokens/min for that tenant.",
              ],
              [
                "Under limit → direct call",
                "Request is proxied straight to the LLM provider (Groq), with circuit-breaker failover to OpenAI if Groq is down.",
              ],
              [
                "Over limit → queued",
                "Request is pushed into a BullMQ priority queue instead of getting a 429 — high-priority tenants jump ahead of low-priority ones.",
              ],
              [
                "Worker drains queue",
                "Background workers pull queued jobs and call the provider once the tenant's bucket refills.",
              ],
            ].map(([title, desc], i) => (
              <li
                key={title}
                className="flex gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
              "Circuit breaker trips off a failing provider and reroutes traffic.",
            ],
          ].map(([title, desc]) => (
            <div
              key={title}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <p className="text-sm font-medium">{title}</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {desc}
              </p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
