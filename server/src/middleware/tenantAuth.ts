import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { tenants } from "../db/schema.js";

export interface TenantContext {
  id: string;
  rpmLimit: number;
  tpmLimit: number;
  priority: "high" | "medium" | "low";
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

export async function tenantAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const key = req.header("X-Gateway-Key");
  console.log("[gateway] tenantAuth - key present:", !!key);

  if (!key) {
    return res.status(401).json({ error: "X-Gateway-Key header required" });
  }

  const hash = crypto.createHash("sha256").update(key).digest("hex");

  try {
    const [tenant] = await db
      .select({
        id: tenants.id,
        rpmLimit: tenants.rpmLimit,
        tpmLimit: tenants.tpmLimit,
        priority: tenants.priority,
      })
      .from(tenants)
      .where(eq(tenants.apiKeyHash, hash));

    if (!tenant) {
      console.log("[gateway] tenantAuth - no match for key hash");
      return res.status(401).json({ error: "Invalid API key" });
    }

    req.tenant = tenant;
    console.log("[gateway] tenantAuth - resolved tenant:", tenant.id);
    next();
  } catch (err) {
    console.error("[gateway] tenantAuth failed:", err);
    res.status(500).json({ error: "Internal error validating key" });
  }
}
