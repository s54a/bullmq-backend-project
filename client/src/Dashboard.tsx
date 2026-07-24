import { useEffect, useState } from "react";

type Tenant = {
  id: string;
  rpmLimit: number;
  tpmLimit: number;
  priority: "high" | "medium" | "low";
  createdAt: string;
};

type Metrics = {
  queue: Record<string, number>;
  queuedByTenant: Record<string, number>;
  timestamp: string;
};

export default function Dashboard() {
  const [adminSecret, setAdminSecret] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(secret: string) {
    try {
      const headers = { "X-Admin-Secret": secret };
      const [tRes, mRes] = await Promise.all([
        fetch("/admin/tenants", { headers }),
        fetch("/admin/metrics/health", { headers }),
      ]);
      if (!tRes.ok || !mRes.ok) throw new Error("Invalid admin secret");
      setTenants(await tRes.json());
      setMetrics(await mRes.json());
      setUnlocked(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setUnlocked(false);
    }
  }

  useEffect(() => {
    if (!unlocked) return;
    const interval = setInterval(() => load(adminSecret), 3000);
    return () => clearInterval(interval);
  }, [unlocked, adminSecret]);

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-sm px-4 py-24">
        <h1 className="mb-4 text-lg font-semibold">Admin dashboard</h1>
        <input
          type="password"
          value={adminSecret}
          onChange={(e) => setAdminSecret(e.target.value)}
          placeholder="Admin secret"
          className="mb-3 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        />
        <button
          onClick={() => load(adminSecret)}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          Unlock
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold">Live Gateway Metrics</h1>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {metrics &&
          Object.entries(metrics.queue).map(([state, count]) => (
            <div
              key={state}
              className="rounded-lg border border-zinc-200 p-4 text-center dark:border-zinc-800"
            >
              <p className="text-2xl font-semibold">{count}</p>
              <p className="text-xs text-zinc-500 uppercase">{state}</p>
            </div>
          ))}
      </section>

      <h2 className="mb-3 text-sm font-semibold tracking-wide text-zinc-400 uppercase">
        Tenants
      </h2>
      <div className="flex flex-col gap-2">
        {tenants.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
          >
            <span className="font-mono text-xs">{t.id.slice(0, 8)}…</span>
            <span>
              {t.rpmLimit} rpm / {t.tpmLimit} tpm
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-900">
              {t.priority}
            </span>
            <span>{metrics?.queuedByTenant[t.id] ?? 0} queued</span>
          </div>
        ))}
        {tenants.length === 0 && (
          <p className="text-sm text-zinc-500">
            No tenants yet — create one via POST /admin/tenants.
          </p>
        )}
      </div>
    </div>
  );
}
