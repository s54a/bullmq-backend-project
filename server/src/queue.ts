import { Queue } from "bullmq";
import IORedis from "ioredis";

export const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

export const videoQueue = new Queue("video-processing", {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
    attempts: 1,
    backoff: { type: "exponential", delay: 2000 },
  },
});

export const chatQueue = new Queue("chat-completions", {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
    attempts: 1,
    backoff: { type: "exponential", delay: 2000 },
  },
});
