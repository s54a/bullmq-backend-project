import "dotenv/config";
import path from "path";
import express, { Request, Response } from "express";
import cors from "cors";
import { Queue } from "bullmq";
import { connection } from "./queue.js";
import { adminRouter } from "./routes/admin.js";
import { tenantAuth } from "./middleware/tenantAuth.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { chatQueue } from "./queue.js";
import { getChatCompletion } from "./lib/provider.js";
import "./worker.js";
const app = express();
app.use(cors());
app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000" }));

const __dirname = path.resolve();

// We instantiate a Queue here to add jobs and check states
const videoQueue = new Queue("video-processing", { connection });

app.get("/", (req: Request, res: Response) => {
  res.send("API is running");
});

app.use("/admin", adminRouter);

// POST: Add job to queue
app.post("/api/jobs", async (req: Request, res: Response) => {
  try {
    const { videoName } = req.body;

    const job = await videoQueue.add("processVideo", {
      videoName: videoName || "untitled-video.mp4",
      uploadedAt: new Date().toISOString(),
    });

    res.status(202).json({
      message: "Job added to queue",
      jobId: job.id,
    });
  } catch (error) {
    console.error("Error adding job:", error);
    res.status(500).json({ error: "Failed to add job" });
  }
});

// GET: Check job status (Used by the React frontend)
app.get("/api/jobs/:id", async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const job = await videoQueue.getJob(req.params.id);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Get the progress (worker updates this)
    const progress = job.progress as number;

    res.json({
      id: job.id,
      state: await job.getState(), // 'completed', 'active', 'waiting', etc.
      progress: progress,
      result: job.returnvalue, // The data returned by the worker when done
    });
  } catch (error) {
    console.error("Error fetching job:", error);
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

app.post(
  "/v1/chat/completions",
  tenantAuth,
  rateLimit,
  async (req: Request, res: Response) => {
    console.log("[gateway] processing request for tenant:", req.tenant!.id);
    try {
      const response = await getChatCompletion(req.body.messages);
      res.status(200).json(response);
    } catch (error) {
      console.error("[gateway] provider call failed:", error);
      res.status(500).json({ error: "Provider call failed" });
    }
  },
);

app.get("/v1/chat/status/:jobId", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const job = await chatQueue.getJob(id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    const state = await job.getState();
    if (state === "completed")
      return res.json({ status: "completed", result: job.returnvalue });
    if (state === "failed") return res.json({ status: "failed" });
    return res.json({ status: "waiting" });
  } catch (err) {
    res.status(500).json({ error: "Failed to get status" });
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
