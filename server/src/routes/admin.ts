import { Router, Request, Response } from "express";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { tenants } from "../db/schema.js";

export const adminRouter = Router();

console.log("[admin] Admin router initialized");

function requireAdminAuth(req: Request, res: Response, next: () => void) {
  console.log("[admin] Auth check - Headers:", req.headers);
  const secret = req.header("X-Admin-Secret");
  console.log("[admin] Received secret:", secret ? "***" : "missing");
  console.log(
    "[admin] Expected secret:",
    process.env.ADMIN_SECRET ? "***" : "missing",
  );

  if (!secret || secret !== process.env.ADMIN_SECRET) {
    console.log("[admin] Auth failed");
    return res.status(401).json({ error: "Unauthorized" });
  }
  console.log("[admin] Auth passed");
  next();
}
adminRouter.use(requireAdminAuth);

function generateApiKey() {
  const raw = `agw_${crypto.randomBytes(24).toString("hex")}`;
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

// POST /admin/tenants
adminRouter.post("/tenants", async (req: Request, res: Response) => {
  console.log("[admin] POST /tenants START - Body:", JSON.stringify(req.body));
  try {
    const { rpm_limit, tpm_limit, priority } = req.body;
    console.log("[admin] Parsed values:", { rpm_limit, tpm_limit, priority });

    if (!rpm_limit || !tpm_limit) {
      console.log("[admin] Missing required fields");
      return res
        .status(400)
        .json({ error: "rpm_limit and tpm_limit are required" });
    }
    if (priority && !["high", "medium", "low"].includes(priority)) {
      console.log("[admin] Invalid priority:", priority);
      return res
        .status(400)
        .json({ error: "priority must be high, medium, or low" });
    }

    console.log("[admin] Generating API key...");
    const { raw, hash } = generateApiKey();
    console.log("[admin] API key generated, inserting into database...");

    const [tenant] = await db
      .insert(tenants)
      .values({
        apiKeyHash: hash,
        rpmLimit: rpm_limit,
        tpmLimit: tpm_limit,
        priority: priority || "medium",
      })
      .returning();

    console.log("[admin] Tenant created successfully:", tenant.id);
    res.status(201).json({
      id: tenant.id,
      apiKey: raw,
      rpmLimit: tenant.rpmLimit,
      tpmLimit: tenant.tpmLimit,
      priority: tenant.priority,
      createdAt: tenant.createdAt,
    });
  } catch (err) {
    console.error("[admin] POST /tenants failed:", err);
    res.status(500).json({ error: "Internal error creating tenant" });
  }
});

// GET /admin/tenants
adminRouter.get("/tenants", async (_req: Request, res: Response) => {
  console.log("[admin] GET /tenants START");
  try {
    const rows = await db
      .select({
        id: tenants.id,
        rpmLimit: tenants.rpmLimit,
        tpmLimit: tenants.tpmLimit,
        priority: tenants.priority,
        createdAt: tenants.createdAt,
      })
      .from(tenants);
    console.log(`[admin] Retrieved ${rows.length} tenants`);
    res.json(rows);
  } catch (err) {
    console.error("[admin] GET /tenants failed:", err);
    res.status(500).json({ error: "Internal error fetching tenants" });
  }
});

// GET /admin/tenants/:id
adminRouter.get("/tenants/:id", async (req: Request, res: Response) => {
  console.log("[admin] GET /tenants/:id START - ID:", req.params.id);
  try {
    const id = req.params.id as string;
    const [tenant] = await db
      .select({
        id: tenants.id,
        rpmLimit: tenants.rpmLimit,
        tpmLimit: tenants.tpmLimit,
        priority: tenants.priority,
        createdAt: tenants.createdAt,
      })
      .from(tenants)
      .where(eq(tenants.id, id));

    if (!tenant) {
      console.log("[admin] Tenant not found:", id);
      return res.status(404).json({ error: "Tenant not found" });
    }
    console.log("[admin] Tenant found:", tenant.id);
    res.json(tenant);
  } catch (err) {
    console.error("[admin] GET /tenants/:id failed:", err);
    res.status(500).json({ error: "Internal error fetching tenant" });
  }
});

// PATCH /admin/tenants/:id
adminRouter.patch("/tenants/:id", async (req: Request, res: Response) => {
  console.log("[admin] PATCH /tenants/:id START - ID:", req.params.id);
  try {
    const id = req.params.id as string;
    const { rpm_limit, tpm_limit, priority } = req.body;
    console.log("[admin] Update values:", { rpm_limit, tpm_limit, priority });

    const [updated] = await db
      .update(tenants)
      .set({
        ...(rpm_limit && { rpmLimit: rpm_limit }),
        ...(tpm_limit && { tpmLimit: tpm_limit }),
        ...(priority && { priority }),
      })
      .where(eq(tenants.id, id))
      .returning({
        id: tenants.id,
        rpmLimit: tenants.rpmLimit,
        tpmLimit: tenants.tpmLimit,
        priority: tenants.priority,
        createdAt: tenants.createdAt,
      });

    if (!updated) {
      console.log("[admin] Tenant not found for update:", id);
      return res.status(404).json({ error: "Tenant not found" });
    }
    console.log("[admin] Tenant updated:", updated.id);
    res.json(updated);
  } catch (err) {
    console.error("[admin] PATCH /tenants/:id failed:", err);
    res.status(500).json({ error: "Internal error updating tenant" });
  }
});

// DELETE /admin/tenants/:id
adminRouter.delete("/tenants/:id", async (req: Request, res: Response) => {
  console.log("[admin] DELETE /tenants/:id START - ID:", req.params.id);
  try {
    const id = req.params.id as string;
    const [deleted] = await db
      .delete(tenants)
      .where(eq(tenants.id, id))
      .returning();

    if (!deleted) {
      console.log("[admin] Tenant not found for delete:", id);
      return res.status(404).json({ error: "Tenant not found" });
    }
    console.log("[admin] Tenant deleted:", deleted.id);
    res.status(204).send();
  } catch (err) {
    console.error("[admin] DELETE /tenants/:id failed:", err);
    res.status(500).json({ error: "Internal error deleting tenant" });
  }
});
