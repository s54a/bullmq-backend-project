import { Router, Request, Response } from "express";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { tenants } from "../db/schema";

export const adminRouter = Router();

function requireAdminAuth(req: Request, res: Response, next: () => void) {
  const secret = req.header("X-Admin-Secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
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
  const { rpm_limit, tpm_limit, priority } = req.body;

  if (!rpm_limit || !tpm_limit) {
    return res
      .status(400)
      .json({ error: "rpm_limit and tpm_limit are required" });
  }
  if (priority && !["high", "medium", "low"].includes(priority)) {
    return res
      .status(400)
      .json({ error: "priority must be high, medium, or low" });
  }

  const { raw, hash } = generateApiKey();

  const [tenant] = await db
    .insert(tenants)
    .values({
      apiKeyHash: hash,
      rpmLimit: rpm_limit,
      tpmLimit: tpm_limit,
      priority: priority || "medium",
    })
    .returning();

  // raw key is returned ONCE — not retrievable again, only the hash is stored
  res.status(201).json({
    id: tenant.id,
    apiKey: raw,
    rpmLimit: tenant.rpmLimit,
    tpmLimit: tenant.tpmLimit,
    priority: tenant.priority,
    createdAt: tenant.createdAt,
  });
});

// GET /admin/tenants
adminRouter.get("/tenants", async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      id: tenants.id,
      rpmLimit: tenants.rpmLimit,
      tpmLimit: tenants.tpmLimit,
      priority: tenants.priority,
      createdAt: tenants.createdAt,
    })
    .from(tenants);
  res.json(rows);
});

// GET /admin/tenants/:id
adminRouter.get("/tenants/:id", async (req: Request, res: Response) => {
  const id = req.params.id as string; // Type assertion
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

  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  res.json(tenant);
});

// PATCH /admin/tenants/:id
adminRouter.patch("/tenants/:id", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { rpm_limit, tpm_limit, priority } = req.body;

  const [updated] = await db
    .update(tenants)
    .set({
      ...(rpm_limit && { rpmLimit: rpm_limit }),
      ...(tpm_limit && { tpmLimit: tpm_limit }),
      ...(priority && { priority }),
    })
    .where(eq(tenants.id, id))
    .returning();

  if (!updated) return res.status(404).json({ error: "Tenant not found" });
  res.json(updated);
});

// DELETE /admin/tenants/:id
adminRouter.delete("/tenants/:id", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const [deleted] = await db
    .delete(tenants)
    .where(eq(tenants.id, id))
    .returning();

  if (!deleted) return res.status(404).json({ error: "Tenant not found" });
  res.status(204).send();
});
