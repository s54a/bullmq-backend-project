import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

type ResultState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "queued"; status: number; jobId: string; raw: unknown }
  | { kind: "success"; status: number; body: unknown }
  | { kind: "error"; status: number | null; message: string; body?: unknown };

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {children}
    </div>
  );
}
function CardHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-zinc-100 p-5 dark:border-zinc-900">
      {children}
    </div>
  );
}
function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
      {children}
    </h2>
  );
}
function CardDescription({ children }: { children: ReactNode }) {
  return <p className="text-sm text-zinc-500 dark:text-zinc-400">{children}</p>;
}
function CardContent({ children }: { children: ReactNode }) {
  return <div className="p-5">{children}</div>;
}

const inputBase =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-xs transition outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10";

function Button({
  children,
  disabled,
  onClick,
  type = "button",
  variant = "primary",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "ghost";
}) {
  const variants = {
    primary:
      "bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200",
    ghost:
      "bg-transparent text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900",
  } as const;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "neutral" | "green" | "amber" | "red" | "blue";
}) {
  const tones = {
    neutral:
      "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 ring-zinc-200 dark:ring-zinc-800",
    green:
      "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
    amber:
      "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
    red: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-900",
    blue: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function extractJobId(body: unknown): string {
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    if (typeof rec.jobId === "string") return rec.jobId;
    if (typeof rec.job_id === "string") return rec.job_id;
    if (typeof rec.id === "string") return rec.id;
  }
  return "unknown";
}
function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    if (typeof rec.error === "string") return rec.error;
    if (typeof rec.message === "string") return rec.message;
    if (
      typeof rec.error === "object" &&
      rec.error &&
      typeof (rec.error as Record<string, unknown>).message === "string"
    ) {
      return (rec.error as Record<string, unknown>).message as string;
    }
  }
  if (typeof body === "string" && body.trim()) return body.trim();
  return fallback;
}
function tryStringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function Playground() {
  const [apiKey, setApiKey] = useState(
    "agw_0ea0e99c120104b29a814a8b0c8b8bd7fdae3142b585cf20",
  );
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<ResultState>({ kind: "idle" });
  const [showRaw, setShowRaw] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (result.kind !== "queued") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/v1/chat/status/${result.jobId}`);
        const data = await res.json();
        if (data.status === "completed") {
          setResult({ kind: "success", status: 200, body: data.result });
          clearInterval(interval);
        } else if (data.status === "failed") {
          setResult({
            kind: "error",
            status: 500,
            message: "Queued job failed.",
          });
          clearInterval(interval);
        }
      } catch {
        /* ignore polling errors */
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [result.kind]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const canSubmit = apiKey.trim().length > 0 && prompt.trim().length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setShowRaw(false);
    setResult({ kind: "loading" });
    try {
      const res = await fetch("/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gateway-Key": apiKey.trim(),
        },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
        signal: controller.signal,
      });
      const text = await res.text();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* keep raw text */
      }

      if (res.status === 202) {
        setResult({
          kind: "queued",
          status: 202,
          jobId: extractJobId(parsed),
          raw: parsed,
        });
      } else if (res.status === 200) {
        setResult({ kind: "success", status: 200, body: parsed });
      } else if (res.status === 401 || res.status === 500) {
        setResult({
          kind: "error",
          status: res.status,
          message: extractErrorMessage(
            parsed,
            res.status === 401
              ? "Unauthorized — check your API key."
              : "Server error (500).",
          ),
          body: parsed,
        });
      } else {
        setResult({
          kind: "error",
          status: res.status,
          message: `Unexpected status ${res.status}.`,
          body: parsed,
        });
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setResult({
        kind: "error",
        status: null,
        message: err instanceof Error ? err.message : "Network request failed.",
      });
    }
  }

  function handleReset() {
    abortRef.current?.abort();
    setResult({ kind: "idle" });
    setShowRaw(false);
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Gateway Chat Client
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            POST to{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-900">
              /v1/chat/completions
            </code>{" "}
            with an{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-900">
              X-Gateway-Key
            </code>{" "}
            header.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Request</CardTitle>
            <CardDescription>
              Provide your gateway API key and the user prompt to send.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
              autoComplete="off"
            >
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="apiKey"
                  className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  API Key
                </label>
                <input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="gw_••••••••••••••••"
                  className={inputBase}
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="prompt"
                  className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Prompt
                </label>
                <textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ask anything…"
                  rows={5}
                  className={`${inputBase} resize-y font-mono`}
                  spellCheck={false}
                />
              </div>
              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  Body:{" "}
                  <code className="font-mono">
                    {"{ messages: [{ role: 'user', content }] }"}
                  </code>
                </p>
                <div className="flex gap-2">
                  {result.kind !== "idle" && (
                    <Button variant="ghost" onClick={handleReset}>
                      Clear
                    </Button>
                  )}
                  <Button type="submit" disabled={!canSubmit}>
                    {result.kind === "loading" ? "Sending…" : "Send"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle>Response</CardTitle>
                <CardDescription>
                  Status code and parsed body from the gateway.
                </CardDescription>
              </div>
              {result.kind === "idle" && <Badge tone="neutral">IDLE</Badge>}
              {result.kind === "loading" && <Badge tone="blue">SENDING</Badge>}
              {result.kind === "queued" && (
                <Badge tone="amber">{result.status} QUEUED</Badge>
              )}
              {result.kind === "success" && (
                <Badge tone="green">{result.status} OK</Badge>
              )}
              {result.kind === "error" && (
                <Badge tone="red">{result.status ?? "ERROR"}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {result.kind === "idle" && (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-200 py-10 text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
                No request sent yet.
              </div>
            )}
            {result.kind === "loading" && (
              <div className="flex items-center gap-3 py-6 text-sm text-zinc-500 dark:text-zinc-400">
                Waiting for response…
              </div>
            )}
            {result.kind === "queued" && (
              <div className="flex flex-col gap-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    Queued
                  </p>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                    The gateway accepted the request and will process it
                    asynchronously.
                  </p>
                  <div className="mt-3 flex flex-col gap-1">
                    <span className="text-xs font-medium tracking-wide text-amber-600 uppercase dark:text-amber-400">
                      Job ID
                    </span>
                    <code className="rounded bg-white/70 px-2 py-1.5 font-mono text-sm break-all text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-900">
                      {result.jobId}
                    </code>
                  </div>
                </div>
                <RawToggle
                  raw={result.raw}
                  showRaw={showRaw}
                  onToggleRaw={() => setShowRaw((v) => !v)}
                />
              </div>
            )}
            {result.kind === "success" && (
              <div className="flex flex-col gap-4">
                <RawToggle
                  raw={result.body}
                  showRaw={showRaw}
                  onToggleRaw={() => setShowRaw((v) => !v)}
                />
              </div>
            )}
            {result.kind === "error" && (
              <div className="flex flex-col gap-4">
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
                  <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                    {result.status !== null
                      ? `Error ${result.status}`
                      : "Request failed"}
                  </p>
                  <p className="mt-1 text-sm break-words text-red-700 dark:text-red-300">
                    {result.message}
                  </p>
                </div>
                {result.body !== undefined && (
                  <RawToggle
                    raw={result.body}
                    showRaw={showRaw}
                    onToggleRaw={() => setShowRaw((v) => !v)}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RawToggle({
  raw,
  showRaw,
  onToggleRaw,
}: {
  raw: unknown;
  showRaw: boolean;
  onToggleRaw: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onToggleRaw}
        className="self-start text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        {showRaw ? "Hide raw JSON" : "Show raw JSON"}
      </button>
      {showRaw && (
        <pre className="max-h-96 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
          {tryStringify(raw)}
        </pre>
      )}
    </div>
  );
}
