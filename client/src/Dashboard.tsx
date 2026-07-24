import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Clock3,
  Database,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
  health?: { gateway: string; redis: string };
};
type Session = { kind: "admin"; secret: string } | { kind: "demo" };
type Snapshot = { at: number; waiting: number; active: number };
const SESSION_KEY = "aegis-dashboard-session";

export default function Dashboard() {
  const [session, setSession] = useState<Session | null>(() => {
    const value = sessionStorage.getItem(SESSION_KEY);
    try {
      return value ? (JSON.parse(value) as Session) : null;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  });
  const [secret, setSecret] = useState(
    "Ih5zfa3XaibYrs9uQWv5x6cfnWXOTOfoSgXceL8PvWSIW9kRVZHhXPKK8r9EQQfnKEdkr40Be2kHODyxu94TPQ",
  );
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (activeSession = session) => {
      if (!activeSession) return false;
      setLoading(true);
      try {
        const isDemo = activeSession.kind === "demo";
        const headers = isDemo
          ? undefined
          : { "X-Admin-Secret": activeSession.secret };
        const [tenantResponse, metricResponse] = await Promise.all(
          isDemo
            ? [fetch("/demo/dashboard"), fetch("/demo/dashboard")]
            : [
                fetch("/admin/tenants", { headers }),
                fetch("/admin/metrics/health", { headers }),
              ],
        );
        if (!tenantResponse.ok || !metricResponse.ok)
          throw new Error(
            isDemo
              ? "Demo dashboard is unavailable."
              : "Your admin session is no longer valid.",
          );
        const tenantPayload = await tenantResponse.json();
        const metricPayload = await metricResponse.json();
        const nextTenants = isDemo ? tenantPayload.tenants : tenantPayload;
        const nextMetrics = isDemo ? metricPayload.metrics : metricPayload;
        setTenants(nextTenants);
        setMetrics(nextMetrics);
        setSnapshots((current) => [
          ...current.slice(-19),
          {
            at: Date.now(),
            waiting: nextMetrics.queue.waiting ?? 0,
            active: nextMetrics.queue.active ?? 0,
          },
        ]);
        setError(null);
        return true;
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "Failed to load dashboard.";
        setError(message);
        if (activeSession.kind === "admin") {
          sessionStorage.removeItem(SESSION_KEY);
          setSession(null);
        }
        return false;
      } finally {
        setLoading(false);
      }
    },
    [session],
  );

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!session || paused) return;
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [session, paused, load]);

  async function authenticate(kind: Session["kind"]) {
    const next =
      kind === "demo"
        ? ({ kind } as Session)
        : ({ kind, secret: secret.trim() } as Session);
    if (kind === "admin" && !secret.trim()) {
      setError("Enter your admin secret to continue.");
      return;
    }
    const ok = await load(next);
    if (ok) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
      setSession(next);
    }
  }
  function logOut() {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setTenants([]);
    setMetrics(null);
    setSnapshots([]);
    setError(null);
  }

  if (!session)
    return (
      <Login
        secret={secret}
        setSecret={setSecret}
        error={error}
        loading={loading}
        onAdmin={() => void authenticate("admin")}
        onDemo={() => void authenticate("demo")}
      />
    );

  const states = ["waiting", "active", "completed", "failed", "delayed"];
  const lastRefreshed = metrics
    ? new Date(metrics.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-blue-600">
              AEGIS CONTROL PLANE
            </p>
            {session.kind === "demo" && (
              <Badge className="border-blue-100 bg-blue-50 text-blue-700">
                Read-only demo
              </Badge>
            )}
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Observe every tenant lane.
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Queue metrics refresh every four seconds in this browser session.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? <Play /> : <Pause />}
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
          {session.kind === "admin" && (
            <Button variant="ghost" size="sm" onClick={logOut}>
              Log out
            </Button>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <Health
          label="Gateway"
          value={metrics?.health?.gateway ?? "Connected"}
          icon={ShieldCheck}
          tone="emerald"
        />
        <Health
          label="Redis queue"
          value={metrics?.health?.redis ?? "Connected"}
          icon={Database}
          tone="emerald"
        />
        <Health
          label="Last refreshed"
          value={lastRefreshed}
          icon={Clock3}
          tone="blue"
        />
      </section>
      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {states.map((state) => (
          <Card key={state} className="border-zinc-200 shadow-none">
            <CardContent className="p-5">
              <p className="text-2xl font-semibold tracking-tight">
                {metrics?.queue[state] ?? "—"}
              </p>
              <p className="mt-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                {state}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <Card className="border-zinc-200 shadow-none">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Live session trend</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Waiting and active jobs while this tab is open.
                </p>
              </div>
              <Activity className="size-5 text-blue-600" />
            </div>
            <Trend snapshots={snapshots} />
          </CardContent>
        </Card>
        <Card className="border-zinc-200 shadow-none">
          <CardContent className="p-6">
            <h2 className="font-semibold">Queue status</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              {(metrics?.queue.waiting ?? 0) + (metrics?.queue.delayed ?? 0) > 0
                ? "Queued work is visible below by tenant."
                : "No queued work right now—send a burst in Playground to watch requests appear here."}
            </p>
            <div className="mt-5 rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
              Metrics reflect BullMQ’s current retained job counts, not lifetime
              throughput.
            </div>
          </CardContent>
        </Card>
      </section>
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Tenant lanes</h2>
            <p className="mt-1 text-sm text-zinc-500">
              API keys are never displayed in this table.
            </p>
          </div>
          <span className="text-sm text-zinc-500">
            {tenants.length} tenants
          </span>
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-200">
          <div className="hidden grid-cols-[1.2fr_1fr_1fr_.8fr_.8fr] gap-4 border-b border-zinc-200 bg-zinc-50 px-5 py-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase sm:grid">
            <span>Tenant</span>
            <span>RPM</span>
            <span>Est. TPM</span>
            <span>Priority</span>
            <span>Queued</span>
          </div>
          {tenants.map((tenant) => (
            <div
              key={tenant.id}
              className="grid gap-3 border-b border-zinc-100 px-5 py-4 text-sm last:border-b-0 sm:grid-cols-[1.2fr_1fr_1fr_.8fr_.8fr] sm:items-center"
            >
              <span className="font-mono text-xs text-zinc-700">
                {tenant.id.slice(0, 8)}••••
              </span>
              <span>
                <b className="sm:hidden">RPM: </b>
                {tenant.rpmLimit}
              </span>
              <span>
                <b className="sm:hidden">Est. TPM: </b>
                {tenant.tpmLimit}
              </span>
              <span>
                <Priority value={tenant.priority} />
              </span>
              <span>
                <b className="sm:hidden">Queued: </b>
                {metrics?.queuedByTenant[tenant.id] ?? 0}
              </span>
            </div>
          ))}
          {tenants.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-zinc-500">
              No tenants are provisioned yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Login({
  secret,
  setSecret,
  error,
  loading,
  onAdmin,
  onDemo,
}: {
  secret: string;
  setSecret: (value: string) => void;
  error: string | null;
  loading: boolean;
  onAdmin: () => void;
  onDemo: () => void;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:py-28">
      <div className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-xl shadow-zinc-950/5">
        <div className="justify- flex items-center justify-center">
          <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50">
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
          <p className="ml-2 text-sm font-semibold text-blue-600">
            AEGIS CONTROL PLANE
          </p>
        </div>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          See the system operating.
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Log in with an administrator secret or open the safe, read-only demo
          dashboard.
        </p>
        <label className="mt-6 block text-sm font-medium">
          Admin secret
          <input
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && onAdmin()}
            placeholder="Enter admin secret"
            className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <Button
          className="mt-4 w-full bg-zinc-800 hover:bg-zinc-950"
          onClick={onAdmin}
          disabled={loading}
        >
          Log in
        </Button>
        <Button
          variant="outline"
          className="mt-2 w-full"
          onClick={onDemo}
          disabled={loading}
        >
          Explore demo dashboard
        </Button>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
function Health({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof ShieldCheck;
  tone: "emerald" | "blue";
}) {
  return (
    <Card className="border-zinc-200 shadow-none">
      <CardContent className="flex items-center gap-3 p-4">
        <span
          className={`flex size-9 items-center justify-center rounded-lg ${tone === "emerald" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}
        >
          <Icon className="size-4" />
        </span>
        <div>
          <p className="text-xs text-zinc-500">{label}</p>
          <p className="text-sm font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
function Priority({ value }: { value: Tenant["priority"] }) {
  const color =
    value === "high"
      ? "bg-blue-50 text-blue-700"
      : value === "medium"
        ? "bg-amber-50 text-amber-700"
        : "bg-zinc-100 text-zinc-600";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${color}`}
    >
      {value}
    </span>
  );
}
function Trend({ snapshots }: { snapshots: Snapshot[] }) {
  const max = Math.max(1, ...snapshots.flatMap((s) => [s.waiting, s.active]));
  const points = (key: "waiting" | "active") =>
    snapshots
      .map(
        (snapshot, index) =>
          `${snapshots.length === 1 ? 0 : (index / (snapshots.length - 1)) * 100},${100 - (snapshot[key] / max) * 82 - 8}`,
      )
      .join(" ");
  return (
    <div className="mt-6 h-44 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
      <svg
        className="h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <line
          x1="0"
          y1="92"
          x2="100"
          y2="92"
          stroke="#e4e4e7"
          strokeWidth="1"
        />
        {snapshots.length > 1 && (
          <>
            <polyline
              points={points("waiting")}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.4"
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              points={points("active")}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.4"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-zinc-500">
        <span>
          <i className="mr-1 inline-block size-2 rounded-full bg-amber-500" />
          Waiting
        </span>
        <span>
          <i className="mr-1 inline-block size-2 rounded-full bg-zinc-800" />
          Active
        </span>
        {snapshots.length < 2 && (
          <span className="text-zinc-400">Collecting snapshots…</span>
        )}
      </div>
    </div>
  );
}
