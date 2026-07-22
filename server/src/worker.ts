import "dotenv/config";
import { Worker } from "bullmq";
import { connection } from "./queue.js";
import { db } from "./db/client.js";
import { usageLogs } from "./db/schema.js";
import { getChatCompletion } from "./lib/provider.js";

const worker = new Worker(
  "chat-completions",
  async (job) => {
    const { tenantId, body } = job.data;
    const start = Date.now();

    const response = await getChatCompletion(body.messages);

    await db.insert(usageLogs).values({
      tenantId,
      provider: "groq/openai",
      tokensUsed: response?.usage?.total_tokens || 0,
      latencyMs: Date.now() - start,
      statusCode: 200,
    });

    return response;
  },
  { connection },
);

worker.on("completed", (job) => console.log(`[worker] Job ${job.id} done.`));
worker.on("failed", (job, err) =>
  console.error(`[worker] Job ${job?.id} failed:`, err?.message),
);
