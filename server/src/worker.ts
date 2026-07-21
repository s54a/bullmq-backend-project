import "dotenv/config";
import { Worker } from "bullmq";
import { connection } from "./queue";

const worker = new Worker(
  "video-processing",
  async (job) => {
    console.log(`Starting job ${job.id} for video: ${job.data.videoName}`);

    // Simulate video encoding
    for (let i = 1; i <= 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await job.updateProgress((i / 5) * 100);
      console.log(`Job ${job.id} progress: ${(i / 5) * 100}%`);
    }

    return {
      status: "completed",
      outputUrl: `cdn.example.com/${job.data.videoName}`,
    };
  },
  { connection },
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} has completed successfully!`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} has failed with error: ${err.message}`);
});

console.log("Worker is listening for jobs...");
