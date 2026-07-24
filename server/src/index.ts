import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express, { Request, Response } from "express";
import cors from "cors";
import { chatQueue } from "./queue.js";
import { adminRouter } from "./routes/admin.js";
import { tenantAuth } from "./middleware/tenantAuth.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { getChatCompletion } from "./lib/provider.js";
import { db } from "./db/client.js";
import { tenants } from "./db/schema.js";
import "./worker.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000" }));
app.use(express.json());
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/admin", adminRouter);

app.post(
  "/v1/chat/completions",
  tenantAuth,
  rateLimit,
  async (req: Request, res: Response) => {
    // console.log("[gateway] processing request for tenant:", req.tenant!.id);
    try {
      const response = await getChatCompletion(req.body.messages);
      res.status(200).json(response);
    } catch (error) {
      console.error("[gateway] provider call failed:", error);
      res.status(500).json({ error: "Provider call failed" });
    }
  },
);

// A deterministic, authenticated demo batch for presentations. The first three
// requests use the real provider path now; the remaining seven become real
// BullMQ jobs with a visible 10-second delayed state before the worker handles
// them. It is deliberately separate from the normal rate-limit middleware.
app.post("/v1/demo/batch", tenantAuth, async (req: Request, res: Response) => {
  const prompts: string[] = Array.isArray(req.body?.prompts)
    ? req.body.prompts
    : [];
  if (
    prompts.length !== 10 ||
    prompts.some((prompt) => typeof prompt !== "string")
  ) {
    return res
      .status(400)
      .json({ error: "Exactly 10 string prompts are required" });
  }

  const tenant = req.tenant!;
  const requests = await Promise.all(
    prompts.slice(0, 3).map(async (prompt, index) => {
      try {
        const result = await getChatCompletion([
          { role: "user", content: prompt },
        ]);
        return {
          id: index + 1,
          prompt,
          status: 200,
          state: "completed",
          result,
        };
      } catch (error) {
        console.error("[demo-batch] immediate provider request failed:", error);
        return {
          id: index + 1,
          prompt,
          status: 500,
          state: "failed",
          error: "Provider call failed",
        };
      }
    }),
  );

  const queued = await Promise.all(
    prompts.slice(3).map(async (prompt, index) => {
      const job = await chatQueue.add(
        "chatCompletion",
        {
          tenantId: tenant.id,
          body: { messages: [{ role: "user", content: prompt }] },
          estimatedTokens: Math.max(1, Math.ceil(prompt.length / 4)),
          queuedAt: new Date().toISOString(),
        },
        {
          delay: 10_000,
          priority:
            tenant.priority === "high"
              ? 1
              : tenant.priority === "medium"
                ? 2
                : 3,
        },
      );
      return {
        id: index + 4,
        prompt,
        status: 202,
        state: "delayed",
        jobId: job.id,
      };
    }),
  );

  res.status(200).json({
    acceptedAt: new Date().toISOString(),
    delayedForSeconds: 10,
    requests: [...requests, ...queued],
  });
});

app.get("/v1/chat/status/:jobId", async (req: Request, res: Response) => {
  try {
    const id = req.params.jobId as string;

    const job = await chatQueue.getJob(id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    const state = await job.getState();
    if (state === "completed")
      return res.json({ status: "completed", result: job.returnvalue });
    if (state === "failed") return res.json({ status: "failed" });
    if (state === "delayed") return res.json({ status: "delayed" });
    if (state === "active") return res.json({ status: "active" });
    return res.json({ status: "waiting" });
  } catch (err) {
    res.status(500).json({ error: "Failed to get status" });
  }
});

// Deliberately read-only public view for the product demo. It exposes no API
// keys or mutation actions, so the frontend never needs an administrator secret.
app.get("/demo/dashboard", async (_req: Request, res: Response) => {
  try {
    const counts = await chatQueue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
    );
    const waitingJobs = await chatQueue.getJobs(["waiting", "delayed"], 0, 200);
    const queuedByTenant: Record<string, number> = {};
    for (const job of waitingJobs) {
      const tenantId = job.data?.tenantId ?? "unknown";
      queuedByTenant[tenantId] = (queuedByTenant[tenantId] ?? 0) + 1;
    }
    const tenantRows = await db
      .select({
        id: tenants.id,
        rpmLimit: tenants.rpmLimit,
        tpmLimit: tenants.tpmLimit,
        priority: tenants.priority,
        createdAt: tenants.createdAt,
      })
      .from(tenants);
    res.json({
      tenants: tenantRows,
      metrics: {
        queue: counts,
        queuedByTenant,
        timestamp: new Date().toISOString(),
        health: { gateway: "Available", redis: "Connected" },
      },
    });
  } catch (error) {
    console.error("[demo] GET /demo/dashboard failed:", error);
    res.status(503).json({ error: "Demo metrics are temporarily unavailable" });
  }
});

app.use(express.static(path.join(__dirname, "../../client/dist")));
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "../../client/dist/index.html")),
);

app.use(
  (
    err: Error,
    _req: Request,
    res: Response,
    _next: (err?: unknown) => void,
  ) => {
    console.error("[unhandled]", err);
    res.status(500).json({ error: "Internal server error" });
  },
);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
});
