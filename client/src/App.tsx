// App.tsx — single file, no extra deps. Drop into a Vite + React 19 + Tailwind v4 project.
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ResultState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "queued";
      status: number;
      jobId: string;
      raw: unknown;
    }
  | { kind: "success"; status: number; body: unknown }
  | {
      kind: "error";
      status: number | null;
      message: string;
      body?: unknown;
    };

/* ------------------------------------------------------------------ */
/*  Tiny shadcn-style primitives (no external deps)                    */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<ResultState>({ kind: "idle" });
  const [showRaw, setShowRaw] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const canSubmit =
    apiKey.trim().length > 0 &&
    prompt.trim().length > 0 &&
    result.kind !== "loading";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setShowRaw(false);
    setResult({ kind: "loading" });

    try {
      const res = await fetch("http://localhost:5000/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gateway-Key": apiKey.trim(),
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
        }),
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
        {/* Header */}
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

        {/* Form */}
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
                    {result.kind === "loading" ? (
                      <>
                        <Spinner /> Sending…
                      </>
                    ) : (
                      "Send"
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Response */}
        <ResponsePanel
          result={result}
          showRaw={showRaw}
          onToggleRaw={() => setShowRaw((v) => !v)}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Response panel                                                     */
/* ------------------------------------------------------------------ */

function ResponsePanel({
  result,
  showRaw,
  onToggleRaw,
}: {
  result: ResultState;
  showRaw: boolean;
  onToggleRaw: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Response</CardTitle>
            <CardDescription>
              Status code and parsed body from the gateway.
            </CardDescription>
          </div>
          <StatusBadge result={result} />
        </div>
      </CardHeader>
      <CardContent>
        {result.kind === "idle" && <EmptyState label="No request sent yet." />}

        {result.kind === "loading" && (
          <div className="flex items-center gap-3 py-6 text-sm text-zinc-500 dark:text-zinc-400">
            <Spinner />
            Waiting for response…
          </div>
        )}

        {result.kind === "queued" && (
          <QueuedView
            jobId={result.jobId}
            raw={result.raw}
            showRaw={showRaw}
            onToggleRaw={onToggleRaw}
          />
        )}

        {result.kind === "success" && (
          <SuccessView
            body={result.body}
            showRaw={showRaw}
            onToggleRaw={onToggleRaw}
          />
        )}

        {result.kind === "error" && (
          <ErrorView
            message={result.message}
            status={result.status}
            body={result.body}
            showRaw={showRaw}
            onToggleRaw={onToggleRaw}
          />
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ result }: { result: ResultState }) {
  if (result.kind === "idle") return <Badge tone="neutral">IDLE</Badge>;
  if (result.kind === "loading") return <Badge tone="blue">SENDING</Badge>;
  if (result.kind === "queued")
    return <Badge tone="amber">{result.status} QUEUED</Badge>;
  if (result.kind === "success")
    return <Badge tone="green">{result.status} OK</Badge>;
  if (result.status === 401) return <Badge tone="red">401 UNAUTHORIZED</Badge>;
  if (result.status === 500) return <Badge tone="red">500 SERVER ERROR</Badge>;
  return <Badge tone="red">ERROR</Badge>;
}

function QueuedView({
  jobId,
  raw,
  showRaw,
  onToggleRaw,
}: {
  jobId: string;
  raw: unknown;
  showRaw: boolean;
  onToggleRaw: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
        <div className="flex items-center gap-2">
          <ClockIcon />
          <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            Queued
          </span>
        </div>
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
          The gateway accepted the request and will process it asynchronously.
        </p>
        <div className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium tracking-wide text-amber-600 uppercase dark:text-amber-400">
            Job ID
          </span>
          <code className="rounded bg-white/70 px-2 py-1.5 font-mono text-sm break-all text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-900">
            {jobId}
          </code>
        </div>
      </div>
      <RawToggle raw={raw} showRaw={showRaw} onToggleRaw={onToggleRaw} />
    </div>
  );
}

function SuccessView({
  body,
  showRaw,
  onToggleRaw,
}: {
  body: unknown;
  showRaw: boolean;
  onToggleRaw: () => void;
}) {
  const content = extractAssistantContent(body);
  return (
    <div className="flex flex-col gap-4">
      {content !== null ? (
        <ChatBubble role="assistant">{content}</ChatBubble>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No assistant content found in response. See raw body below.
        </p>
      )}
      <RawToggle raw={body} showRaw={showRaw} onToggleRaw={onToggleRaw} />
    </div>
  );
}

function ErrorView({
  message,
  status,
  body,
  showRaw,
  onToggleRaw,
}: {
  message: string;
  status: number | null;
  body?: unknown;
  showRaw: boolean;
  onToggleRaw: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
        <div className="flex items-center gap-2">
          <AlertIcon />
          <span className="text-sm font-semibold text-red-800 dark:text-red-200">
            {status !== null ? `Error ${status}` : "Request failed"}
          </span>
        </div>
        <p className="mt-1 text-sm break-words text-red-700 dark:text-red-300">
          {message}
        </p>
      </div>
      {body !== undefined && (
        <RawToggle raw={body} showRaw={showRaw} onToggleRaw={onToggleRaw} />
      )}
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

function ChatBubble({
  role,
  children,
}: {
  role: "assistant";
  children: ReactNode;
}) {
  return (
    <div className="flex w-full justify-start">
      <div className="flex max-w-full flex-col gap-1">
        <span className="px-1 text-xs font-medium tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
          {role}
        </span>
        <div className="rounded-2xl rounded-tl-sm border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
          <p className="break-words whitespace-pre-wrap">{children}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-200 py-10 text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
      {label}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Misc utilities                                                     */
/* ------------------------------------------------------------------ */

function extractAssistantContent(body: unknown): string | null {
  // OpenAI-style: { choices: [{ message: { content } }] }
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    const choices = rec.choices;
    if (Array.isArray(choices) && choices.length > 0) {
      const first = choices[0] as Record<string, unknown> | undefined;
      const message = first?.message as Record<string, unknown> | undefined;
      if (typeof message?.content === "string") return message.content;
    }
    if (typeof rec.content === "string") return rec.content;
    if (typeof rec.response === "string") return rec.response;
  }
  return null;
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      className="h-4 w-4 text-amber-600 dark:text-amber-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      className="h-4 w-4 text-red-600 dark:text-red-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
