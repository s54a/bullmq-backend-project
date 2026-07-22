import { connection } from "../queue.js";

// Atomic check-and-consume token bucket.
// KEYS[1] = bucket key
// ARGV[1] = capacity (max tokens / burst size)
// ARGV[2] = refill rate (tokens per second)
// ARGV[3] = tokens requested
// ARGV[4] = now (ms)
const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillPerSec = tonumber(ARGV[2])
local requested = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local bucket = redis.call("HMGET", key, "tokens", "ts")
local tokens = tonumber(bucket[1])
local ts = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  ts = now
end

local elapsed = math.max(0, now - ts) / 1000
tokens = math.min(capacity, tokens + elapsed * refillPerSec)

local allowed = 0
if tokens >= requested then
  tokens = tokens - requested
  allowed = 1
end

redis.call("HMSET", key, "tokens", tokens, "ts", now)
redis.call("EXPIRE", key, 3600)

return { allowed, tokens }
`;

let scriptSha: string | null = null;

async function loadScript() {
  if (!scriptSha) {
    scriptSha = (await connection.script(
      "LOAD",
      TOKEN_BUCKET_SCRIPT,
    )) as string;
  }
  return scriptSha;
}

export async function consumeToken(
  bucketKey: string,
  capacity: number,
  refillPerSec: number,
  requested: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const sha = await loadScript();
  const now = Date.now();
  try {
    const result = (await connection.evalsha(
      sha,
      1,
      bucketKey,
      capacity,
      refillPerSec,
      requested,
      now,
    )) as [number, string];
    return { allowed: result[0] === 1, remaining: Number(result[1]) };
  } catch (err: any) {
    // NOSCRIPT can happen after a Redis restart flushes the script cache
    if (typeof err?.message === "string" && err.message.includes("NOSCRIPT")) {
      scriptSha = null;
      return consumeToken(bucketKey, capacity, refillPerSec, requested);
    }
    throw err;
  }
}
