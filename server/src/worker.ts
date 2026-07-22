import "dotenv/config";
import { Worker } from "bullmq";
import CircuitBreaker from "opossum";
import { connection } from "./queue";
import { db } from "./db/client";
import { usageLogs } from "./db/schema";

console.log("[worker] Chat completions worker started...");

// --- Provider Calls ---
async function callGroq(messages: any) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API Error (${res.status}): ${errText}`);
  }
  return res.json();
}

async function callOpenAI(messages: any) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API Error (${res.status}): ${errText}`);
  }
  return res.json();
}

// --- Circuit Breaker (Opossum) ---
const breaker = new CircuitBreaker(callGroq, {
  timeout: 10000, // If Groq takes >10s, consider it a failure
  errorThresholdPercentage: 50, // Trip breaker if 50% of recent calls fail
  resetTimeout: 30000, // Try Groq again after 30s
});

breaker.on("open", () =>
  console.warn("[circuit-breaker] Groq breaker OPENED. Routing to OpenAI."),
);
breaker.on("close", () =>
  console.log("[circuit-breaker] Groq breaker CLOSED. Back to normal."),
);

// --- BullMQ Worker ---
const worker = new Worker(
  "chat-completions",
  async (job) => {
    const { tenantId, body, estimatedTokens } = job.data;
    const start = Date.now();

    let provider = "groq";
    let response;

    try {
      // Try primary provider (Groq) via circuit breaker
      response = await breaker.fire(body.messages);
    } catch (err: any) {
      console.warn(
        `[worker] Groq failed for job ${job.id}, falling back to OpenAI. Reason: ${err.message}`,
      );
      provider = "openai";

      // Fallback to secondary provider (OpenAI)
      response = await callOpenAI(body.messages);
    }

    // Extract token usage from provider response
    const tokensUsed = response?.usage?.total_tokens || estimatedTokens;
    const latencyMs = Date.now() - start;

    // Log to Postgres
    await db.insert(usageLogs).values({
      tenantId,
      provider,
      tokensUsed,
      latencyMs,
      statusCode: 200,
    });

    console.log(
      `[worker] Job ${job.id} completed via ${provider} in ${latencyMs}ms (${tokensUsed} tokens)`,
    );

    // Return response to BullMQ (saved as job.returnvalue)
    return response;
  },
  { connection },
);

worker.on("completed", (job) => {
  console.log(`[worker] Job ${job.id} marked as completed.`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] Job ${job?.id} failed permanently:`, err?.message);
});
