import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, CircleDashed, Clock3, Copy, FastForward, KeyRound, Layers3, Send, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Result = { kind: "idle" } | { kind: "loading" } | { kind: "queued"; jobId: string; raw: unknown } | { kind: "success"; body: unknown } | { kind: "error"; message: string; status?: number; body?: unknown };
type BatchStatus = "sending" | "delayed" | "waiting" | "active" | "completed" | "failed";
type BatchRequest = { id: number; prompt: string; status: BatchStatus; httpStatus?: number; jobId?: string; result?: unknown; error?: string };
type Batch = { delayedForSeconds: number; requests: BatchRequest[] };

const examples = ["Summarise why tenant isolation matters in one sentence.", "Write a friendly status update for a queued AI request.", "Explain token budgets to a SaaS customer."];
// Deliberately limited tenant credential for the hackathon demo. Do not replace this with an admin credential.
const demoKey = "agw_0ea0e99c120104b29a814a8b0c8b8bd7fdae3142b585cf20";

export default function Playground() {
  const [apiKey, setApiKey] = useState("");
  const [previousKey, setPreviousKey] = useState("");
  const [prompt, setPrompt] = useState(examples[0]);
  const [result, setResult] = useState<Result>({ kind: "idle" });
  const [showRaw, setShowRaw] = useState(false);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isDemoKeyActive = apiKey.trim() === demoKey;

  function toggleDemoKey() { if (isDemoKeyActive) { setApiKey(previousKey); setPreviousKey(""); } else { setPreviousKey(apiKey); setApiKey(demoKey); } }

  useEffect(() => {
    if (result.kind !== "queued") return;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/v1/chat/status/${result.jobId}`);
        const data = await response.json();
        if (data.status === "completed") setResult({ kind: "success", body: data.result });
        if (data.status === "failed") setResult({ kind: "error", status: 500, message: "Queued job failed." });
      } catch { /* continue polling */ }
    }, 2000);
    return () => window.clearInterval(interval);
  }, [result]);
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!batch || !batch.requests.some((item) => item.jobId && ["delayed", "waiting", "active"].includes(item.status))) return;
    const interval = window.setInterval(async () => {
      const next = await Promise.all(batch.requests.map(async (item) => {
        if (!item.jobId || !["delayed", "waiting", "active"].includes(item.status)) return item;
        try {
          const response = await fetch(`/v1/chat/status/${item.jobId}`);
          const data = await response.json();
          if (data.status === "completed") return { ...item, status: "completed" as const, result: data.result };
          if (data.status === "failed") return { ...item, status: "failed" as const, error: "Worker failed to complete this request." };
          return { ...item, status: data.status as "delayed" | "waiting" | "active" };
        } catch { return item; }
      }));
      setBatch((current) => current ? { ...current, requests: next } : current);
    }, 1200);
    return () => window.clearInterval(interval);
  }, [batch]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!apiKey.trim() || !prompt.trim()) return;
    abortRef.current?.abort(); const controller = new AbortController(); abortRef.current = controller;
    setResult({ kind: "loading" }); setShowRaw(false);
    try {
      const response = await fetch("/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "X-Gateway-Key": apiKey.trim() }, body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }), signal: controller.signal });
      const body = parse(await response.text());
      if (response.status === 202) setResult({ kind: "queued", jobId: jobId(body), raw: body });
      else if (response.ok) setResult({ kind: "success", body });
      else setResult({ kind: "error", status: response.status, message: errorMessage(body, `Request failed with ${response.status}.`), body });
    } catch (error) { if (!controller.signal.aborted) setResult({ kind: "error", message: error instanceof Error ? error.message : "Network request failed." }); }
  }

  async function runRealBatch() {
    if (!apiKey.trim()) { setBatchError("Select “Use demo tenant” or enter a tenant key first."); return; }
    const prompts = Array.from({ length: 10 }, (_, index) => `${prompt} [Batch request ${index + 1}: answer in one concise sentence.]`);
    setBatchError(null);
    setBatch({ delayedForSeconds: 10, requests: prompts.map((item, index) => ({ id: index + 1, prompt: item, status: "sending" })) });
    try {
      const response = await fetch("/v1/demo/batch", { method: "POST", headers: { "Content-Type": "application/json", "X-Gateway-Key": apiKey.trim() }, body: JSON.stringify({ prompts }) });
      const data = await response.json();
      if (!response.ok) throw new Error(errorMessage(data, "Could not start the batch."));
      setBatch({ delayedForSeconds: data.delayedForSeconds ?? 10, requests: data.requests.map((item: { id: number; prompt: string; status: number; state: BatchStatus; jobId?: string; result?: unknown; error?: string }) => ({ id: item.id, prompt: item.prompt, httpStatus: item.status, status: item.state, jobId: item.jobId, result: item.result, error: item.error })) });
    } catch (error) { setBatch(null); setBatchError(error instanceof Error ? error.message : "Could not start the batch."); }
  }

  const lifecycle = result.kind === "queued" ? 2 : result.kind === "success" ? 3 : result.kind === "loading" ? 1 : 0;
  const snippet = `curl -X POST ${window.location.origin}/v1/chat/completions \\\n+  -H "Content-Type: application/json" \\\n+  -H "X-Gateway-Key: YOUR_TENANT_KEY" \\\n+  -d '{"messages":[{"role":"user","content":"${prompt || "Hello"}"}]}'`;
  return <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
    <div className="max-w-3xl"><p className="text-sm font-semibold text-blue-600">INTERACTIVE API DEMO</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Send a request. Watch its lifecycle.</h1><p className="mt-4 text-lg leading-8 text-zinc-600">Use the demo tenant to make real gateway requests and inspect the provider response.</p></div>
    <div className="mt-8 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-4">{[[KeyRound, "Authenticated"], [CheckCircle2, "Budget checked"], [Clock3, "Sent now / queued"], [CircleDashed, "Completed"]].map(([Icon, label], index) => <div key={label as string} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${index <= lifecycle ? "bg-white text-blue-700 shadow-sm" : "text-zinc-400"}`}><span className={`flex size-6 items-center justify-center rounded-full text-xs ${index <= lifecycle ? "bg-zinc-800 text-white" : "bg-zinc-200"}`}>{index + 1}</span><Icon className="size-4" />{label as string}</div>)}</div>
    <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><Card className="border-zinc-200 shadow-none"><CardContent className="p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">Request composer</h2><p className="mt-1 text-sm text-zinc-500">The tenant key is used only for gateway requests.</p></div><Button variant="outline" size="sm" onClick={toggleDemoKey}>{isDemoKeyActive ? "Clear demo key" : "Use demo tenant"}</Button></div><form onSubmit={submit} className="mt-6 space-y-5"><label className="block text-sm font-medium">Tenant API key<input value={apiKey} onChange={(event) => setApiKey(event.target.value)} type="password" placeholder="agw_••••••••••••" className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2.5 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label><div><p className="text-sm font-medium">Example prompt</p><div className="mt-2 flex flex-wrap gap-2">{examples.map((example) => <button type="button" key={example} onClick={() => setPrompt(example)} className={`rounded-full border px-3 py-1.5 text-xs transition ${prompt === example ? "border-blue-200 bg-blue-50 text-blue-700" : "border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}>{example.slice(0, 28)}…</button>)}</div></div><label className="block text-sm font-medium">Prompt<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} className="mt-2 w-full resize-y rounded-lg border border-zinc-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label><Button type="submit" size="lg" className="w-full bg-zinc-800 hover:bg-zinc-950" disabled={!apiKey.trim() || !prompt.trim() || result.kind === "loading"}><Send />{result.kind === "loading" ? "Sending request…" : "Send request"}</Button></form></CardContent></Card><Response result={result} showRaw={showRaw} setShowRaw={setShowRaw} /></div>
    <RealBatchPanel batch={batch} error={batchError} disabled={!apiKey.trim()} onRun={() => void runRealBatch()} />
    <Card className="mt-5 border-zinc-200 shadow-none"><CardContent className="p-6"><div className="flex items-center justify-between"><div><div className="flex items-center gap-2"><Terminal className="size-4 text-blue-600" /><h2 className="font-semibold">cURL</h2></div><p className="mt-1 text-sm text-zinc-500">Use this endpoint from your product server.</p></div><Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(snippet)}><Copy />Copy</Button></div><pre className="mt-5 overflow-x-auto rounded-lg bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">{snippet}</pre></CardContent></Card>
  </div>;
}

function RealBatchPanel({ batch, error, disabled, onRun }: { batch: Batch | null; error: string | null; disabled: boolean; onRun: () => void }) {
  const counts = (status: BatchStatus) => batch?.requests.filter((item) => item.status === status).length ?? 0;
  const pending = counts("delayed") + counts("waiting") + counts("active") + counts("sending");
  return <Card className="mt-5 overflow-hidden border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-none"><CardContent className="p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><Layers3 className="size-4 text-blue-600" /><h2 className="font-semibold">Real 10-request queue batch</h2><Badge className="bg-emerald-100 text-emerald-800">Live gateway calls</Badge></div><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">Aegis makes three real provider calls immediately, then adds seven real BullMQ jobs with a ten-second delay. Every prompt and response is rendered below.</p></div><Button onClick={onRun} className="shrink-0 bg-blue-600 hover:bg-blue-700" disabled={disabled || pending > 0}><FastForward />{pending > 0 ? "Batch running" : "Run real 10-request batch"}</Button></div>{disabled && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Select “Use demo tenant” before running the batch.</p>}{error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}{batch && <><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Immediate 200" value={`${batch.requests.filter((item) => item.id <= 3 && item.status === "completed").length}/3`} tone="emerald" /><Metric label="Queued 202" value={`${batch.requests.filter((item) => item.httpStatus === 202).length}/7`} tone="amber" /><Metric label="Still pending" value={`${pending}`} tone="blue" /><Metric label="Completed" value={`${counts("completed")}/10`} tone="emerald" /></div><p className="mt-4 rounded-lg border border-blue-100 bg-white/80 px-3 py-2 text-xs text-blue-900">The seven queued jobs use a real {batch.delayedForSeconds}-second BullMQ delay before the worker runs them. Keep this page open while it polls their real job status.</p><div className="mt-6 grid gap-3 md:grid-cols-2">{batch.requests.map((item) => <BatchResult key={item.id} item={item} />)}</div></>}</CardContent></Card>;
}
function Metric({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "blue" }) { const colors = { emerald: "border-emerald-200 bg-emerald-50 text-emerald-800", amber: "border-amber-200 bg-amber-50 text-amber-800", blue: "border-blue-200 bg-blue-50 text-blue-800" }; return <div className={`rounded-lg border p-4 ${colors[tone]}`}><p className="text-xl font-semibold">{value}</p><p className="mt-1 text-xs font-medium">{label}</p></div>; }
function BatchResult({ item }: { item: BatchRequest }) { const color = item.status === "completed" ? "border-emerald-200 bg-emerald-50" : item.status === "failed" ? "border-red-200 bg-red-50" : item.status === "active" ? "border-blue-200 bg-blue-50" : "border-amber-200 bg-amber-50"; const label = item.status === "completed" ? "200 completed" : item.status === "failed" ? "Failed" : item.status === "active" ? "Worker processing" : item.status === "delayed" ? "202 queued - delay active" : item.status === "waiting" ? "202 queued - waiting" : "Sending"; return <div className={`rounded-lg border p-4 ${color}`}><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">Request {item.id}</p><Badge variant="secondary">{label}</Badge></div><p className="mt-3 text-xs font-medium text-zinc-500">PROMPT</p><p className="mt-1 text-sm leading-5 text-zinc-800">{item.prompt}</p>{item.jobId && <p className="mt-3 font-mono text-[11px] text-zinc-500">Job {item.jobId}</p>}<p className="mt-3 text-xs font-medium text-zinc-500">RESPONSE</p><p className="mt-1 text-sm leading-5 text-zinc-800">{item.result ? responseText(item.result) : item.error ?? "Waiting for the real job result…"}</p></div>; }
function Response({ result, showRaw, setShowRaw }: { result: Result; showRaw: boolean; setShowRaw: (value: boolean) => void }) { const isQueued = result.kind === "queued"; const isSuccess = result.kind === "success"; const isError = result.kind === "error"; return <Card className="border-zinc-200 shadow-none"><CardContent className="p-6"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Gateway response</h2><p className="mt-1 text-sm text-zinc-500">Status and result from Aegis.</p></div>{result.kind === "idle" && <Badge variant="secondary">Ready</Badge>}{result.kind === "loading" && <Badge className="bg-blue-50 text-blue-700">Sending</Badge>}{isQueued && <Badge className="bg-amber-100 text-amber-800">202 queued</Badge>}{isSuccess && <Badge className="bg-emerald-100 text-emerald-800">200 completed</Badge>}{isError && <Badge variant="destructive">{result.status ?? "Error"}</Badge>}</div><div className="mt-6">{result.kind === "idle" && <Empty text="Send a request to see its lifecycle here." />}{result.kind === "loading" && <Empty text="Aegis is authenticating and checking the tenant budget…" />}{isQueued && <div className="rounded-lg border border-amber-200 bg-amber-50 p-5"><p className="font-semibold text-amber-950">Accepted asynchronously</p><p className="mt-2 text-sm leading-6 text-amber-900">Aegis accepted the request. Polling continues until the real job completes.</p><code className="mt-4 block break-all rounded bg-white/70 p-3 text-xs text-amber-950">{result.jobId}</code><Raw data={result.raw} show={showRaw} setShow={setShowRaw} /></div>}{isSuccess && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5"><p className="font-semibold text-emerald-950">Request completed</p><p className="mt-2 text-sm text-emerald-900">{responseText(result.body)}</p><Raw data={result.body} show={showRaw} setShow={setShowRaw} /></div>}{isError && <div className="rounded-lg border border-red-200 bg-red-50 p-5"><p className="font-semibold text-red-950">{result.message}</p>{result.body && <Raw data={result.body} show={showRaw} setShow={setShowRaw} />}</div>}</div></CardContent></Card>; }
function Empty({ text }: { text: string }) { return <div className="flex min-h-52 items-center justify-center rounded-lg border border-dashed border-zinc-200 px-6 text-center text-sm leading-6 text-zinc-500">{text}</div>; }
function Raw({ data, show, setShow }: { data: unknown; show: boolean; setShow: (value: boolean) => void }) { return <div className="mt-4"><button onClick={() => setShow(!show)} className="text-xs font-medium text-zinc-600 underline underline-offset-4">{show ? "Hide raw JSON" : "Show raw JSON"}</button>{show && <pre className="mt-3 max-h-56 overflow-auto rounded bg-white/70 p-3 text-xs leading-5 text-zinc-800">{JSON.stringify(data, null, 2)}</pre>}</div>; }
function responseText(body: unknown) { const object = body && typeof body === "object" ? body as { choices?: Array<{ message?: { content?: unknown } }> } : null; const content = object?.choices?.[0]?.message?.content; return typeof content === "string" ? content : JSON.stringify(body); }
function parse(value: string) { try { return JSON.parse(value) as unknown; } catch { return value; } }
function jobId(body: unknown) { const record = body && typeof body === "object" ? body as Record<string, unknown> : {}; return typeof record.jobId === "string" ? record.jobId : typeof record.id === "string" ? record.id : "unknown"; }
function errorMessage(body: unknown, fallback: string) { const record = body && typeof body === "object" ? body as Record<string, unknown> : {}; return typeof record.error === "string" ? record.error : typeof record.message === "string" ? record.message : fallback; }
