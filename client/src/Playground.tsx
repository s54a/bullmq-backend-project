import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, CircleDashed, Clock3, Copy, KeyRound, Send, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Result = { kind: "idle" } | { kind: "loading" } | { kind: "queued"; jobId: string; raw: unknown } | { kind: "success"; body: unknown } | { kind: "error"; message: string; status?: number; body?: unknown };
const examples = ["Summarise why tenant isolation matters in one sentence.", "Write a friendly status update for a queued AI request.", "Explain token budgets to a SaaS customer."];
const demoKey = import.meta.env.VITE_DEMO_TENANT_KEY as string | undefined;

export default function Playground() {
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState(examples[0]);
  const [result, setResult] = useState<Result>({ kind: "idle" });
  const [showRaw, setShowRaw] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (result.kind !== "queued") return;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/v1/chat/status/${result.jobId}`);
        const data = await response.json();
        if (data.status === "completed") setResult({ kind: "success", body: data.result });
        if (data.status === "failed") setResult({ kind: "error", status: 500, message: "Queued job failed." });
      } catch { /* keep polling while the demo is temporarily unavailable */ }
    }, 2000);
    return () => window.clearInterval(interval);
  }, [result]);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!apiKey.trim() || !prompt.trim()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setResult({ kind: "loading" }); setShowRaw(false);
    try {
      const response = await fetch("/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "X-Gateway-Key": apiKey.trim() }, body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }), signal: controller.signal });
      const text = await response.text();
      const body = parse(text);
      if (response.status === 202) setResult({ kind: "queued", jobId: jobId(body), raw: body });
      else if (response.ok) setResult({ kind: "success", body });
      else setResult({ kind: "error", status: response.status, message: message(body, `Request failed with ${response.status}.`), body });
    } catch (error) { if (!controller.signal.aborted) setResult({ kind: "error", message: error instanceof Error ? error.message : "Network request failed." }); }
  }
  const lifecycle = result.kind === "queued" ? 2 : result.kind === "success" ? 3 : result.kind === "loading" ? 1 : 0;
  const snippet = `curl -X POST ${window.location.origin}/v1/chat/completions \\\n+  -H "Content-Type: application/json" \\\n+  -H "X-Gateway-Key: YOUR_TENANT_KEY" \\\n+  -d '{"messages":[{"role":"user","content":"${prompt || "Hello"}"}]}'`;

  return <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
    <div className="max-w-3xl"><p className="text-sm font-semibold text-blue-600">INTERACTIVE API DEMO</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Send a request. Watch its lifecycle.</h1><p className="mt-4 text-lg leading-8 text-zinc-600">Use a restricted tenant API key to see the same immediate and asynchronous responses your product receives.</p></div>
    <div className="mt-8 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-4">{[[KeyRound, "Authenticated"], [CheckCircle2, "Budget checked"], [Clock3, "Sent now / queued"], [CircleDashed, "Completed"]].map(([Icon, label], index) => <div key={label as string} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${index <= lifecycle ? "bg-white text-blue-700 shadow-sm" : "text-zinc-400"}`}><span className={`flex size-6 items-center justify-center rounded-full text-xs ${index <= lifecycle ? "bg-blue-600 text-white" : "bg-zinc-200"}`}>{index + 1}</span><Icon className="size-4" />{label as string}</div>)}</div>
    <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><Card className="border-zinc-200 shadow-none"><CardContent className="p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">Request composer</h2><p className="mt-1 text-sm text-zinc-500">The key remains in this browser only.</p></div>{demoKey && <Button variant="outline" size="sm" onClick={() => setApiKey(demoKey)}>Use demo tenant</Button>}</div>{!demoKey && <p className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">A restricted demo key can be configured with <code>VITE_DEMO_TENANT_KEY</code>. Never put an administrator secret here.</p>}<form onSubmit={submit} className="mt-6 space-y-5"><label className="block text-sm font-medium">Tenant API key<input value={apiKey} onChange={event => setApiKey(event.target.value)} type="password" placeholder="agw_••••••••••••" className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2.5 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label><div><p className="text-sm font-medium">Example prompt</p><div className="mt-2 flex flex-wrap gap-2">{examples.map(example => <button type="button" key={example} onClick={() => setPrompt(example)} className={`rounded-full border px-3 py-1.5 text-xs transition ${prompt === example ? "border-blue-200 bg-blue-50 text-blue-700" : "border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}>{example.slice(0, 28)}…</button>)}</div></div><label className="block text-sm font-medium">Prompt<textarea value={prompt} onChange={event => setPrompt(event.target.value)} rows={6} className="mt-2 w-full resize-y rounded-lg border border-zinc-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label><Button type="submit" size="lg" className="w-full bg-blue-600 hover:bg-blue-700" disabled={!apiKey.trim() || !prompt.trim() || result.kind === "loading"}><Send />{result.kind === "loading" ? "Sending request…" : "Send request"}</Button></form></CardContent></Card>
      <Response result={result} showRaw={showRaw} setShowRaw={setShowRaw} /></div>
    <Card className="mt-5 border-zinc-200 shadow-none"><CardContent className="p-6"><div className="flex items-center justify-between"><div><div className="flex items-center gap-2"><Terminal className="size-4 text-blue-600" /><h2 className="font-semibold">cURL</h2></div><p className="mt-1 text-sm text-zinc-500">Use this endpoint from your product server.</p></div><Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(snippet)}><Copy />Copy</Button></div><pre className="mt-5 overflow-x-auto rounded-lg bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">{snippet}</pre></CardContent></Card>
  </div>;
}

function Response({ result, showRaw, setShowRaw }: { result: Result; showRaw: boolean; setShowRaw: (value: boolean) => void }) { const isQueued = result.kind === "queued"; const isSuccess = result.kind === "success"; const isError = result.kind === "error"; return <Card className="border-zinc-200 shadow-none"><CardContent className="p-6"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Gateway response</h2><p className="mt-1 text-sm text-zinc-500">Status and result from Aegis.</p></div>{result.kind === "idle" && <Badge variant="secondary">Ready</Badge>}{result.kind === "loading" && <Badge className="bg-blue-50 text-blue-700">Sending</Badge>}{isQueued && <Badge className="bg-amber-100 text-amber-800">202 queued</Badge>}{isSuccess && <Badge className="bg-emerald-100 text-emerald-800">200 completed</Badge>}{isError && <Badge variant="destructive">{result.status ?? "Error"}</Badge>}</div><div className="mt-6">{result.kind === "idle" && <Empty text="Send a request to see its lifecycle here." />}{result.kind === "loading" && <Empty text="Aegis is authenticating and checking the tenant budget…" />}{isQueued && <div className="rounded-lg border border-amber-200 bg-amber-50 p-5"><p className="font-semibold text-amber-950">Accepted asynchronously</p><p className="mt-2 text-sm leading-6 text-amber-900">Aegis accepted this request. Poll the status endpoint using the job ID while background work is processed.</p><code className="mt-4 block break-all rounded bg-white/70 p-3 text-xs text-amber-950">{result.jobId}</code><Raw data={result.raw} show={showRaw} setShow={setShowRaw} /></div>}{isSuccess && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5"><p className="font-semibold text-emerald-950">Request completed</p><Raw data={result.body} show={showRaw} setShow={setShowRaw} /></div>}{isError && <div className="rounded-lg border border-red-200 bg-red-50 p-5"><p className="font-semibold text-red-950">{result.message}</p>{result.body && <Raw data={result.body} show={showRaw} setShow={setShowRaw} />}</div>}</div></CardContent></Card>; }
function Empty({ text }: { text: string }) { return <div className="flex min-h-52 items-center justify-center rounded-lg border border-dashed border-zinc-200 px-6 text-center text-sm leading-6 text-zinc-500">{text}</div>; }
function Raw({ data, show, setShow }: { data: unknown; show: boolean; setShow: (value: boolean) => void }) { return <div className="mt-4"><button onClick={() => setShow(!show)} className="text-xs font-medium text-zinc-600 underline underline-offset-4">{show ? "Hide raw JSON" : "Show raw JSON"}</button>{show && <pre className="mt-3 max-h-56 overflow-auto rounded bg-white/70 p-3 text-xs leading-5 text-zinc-800">{JSON.stringify(data, null, 2)}</pre>}</div>; }
function parse(value: string) { try { return JSON.parse(value) as unknown; } catch { return value; } }
function jobId(body: unknown) { const record = body && typeof body === "object" ? body as Record<string, unknown> : {}; return typeof record.jobId === "string" ? record.jobId : typeof record.id === "string" ? record.id : "unknown"; }
function message(body: unknown, fallback: string) { const record = body && typeof body === "object" ? body as Record<string, unknown> : {}; return typeof record.error === "string" ? record.error : typeof record.message === "string" ? record.message : fallback; }
