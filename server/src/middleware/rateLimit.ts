import { Request, Response, NextFunction } from "express";
import { consumeToken } from "../lib/tokenBucket";
import { chatQueue } from "../queue";

// Rough estimate until real token counting (tiktoken) lands in Stage 3.
// Reserve/reconcile against actual usage once provider responses are wired up.
function estimateTokens(req: Request): number {
  const bodySize = JSON.stringify(req.body ?? {}).length;
  return Math.max(1, Math.ceil(bodySize / 4));
}

export async function rateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const tenant = req.tenant!;
  const estimatedTokens = estimateTokens(req);

  const rpmKey = `rl:${tenant.id}:rpm`;
  const tpmKey = `rl:${tenant.id}:tpm`;

  // RPM: capacity = burst allowance (1 min worth), refill = limit/60 per sec
  const rpmResult = await consumeToken(
    rpmKey,
    tenant.rpmLimit,
    tenant.rpmLimit / 60,
    1,
  );

  // TPM: capacity = 1 min worth of tokens, refill = limit/60 per sec
  const tpmResult = await consumeToken(
    tpmKey,
    tenant.tpmLimit,
    tenant.tpmLimit / 60,
    estimatedTokens,
  );

  console.log("[gateway] rateLimit", {
    tenant: tenant.id,
    rpmAllowed: rpmResult.allowed,
    tpmAllowed: tpmResult.allowed,
    estimatedTokens,
  });

  if (rpmResult.allowed && tpmResult.allowed) {
    return next();
  }

  // Over limit -> queue instead of reject
  try {
    const job = await chatQueue.add(
      "chatCompletion",
      {
        tenantId: tenant.id,
        body: req.body,
        estimatedTokens,
        queuedAt: new Date().toISOString(),
      },
      {
        priority:
          tenant.priority === "high" ? 1 : tenant.priority === "medium" ? 2 : 3,
      },
    );

    res.status(202).json({
      status: "queued",
      jobId: job.id,
      reason: !rpmResult.allowed ? "rpm_limit_exceeded" : "tpm_limit_exceeded",
    });
  } catch (err) {
    console.error("[gateway] failed to enqueue job:", err);
    res.status(500).json({ error: "Failed to queue request" });
  }
}
