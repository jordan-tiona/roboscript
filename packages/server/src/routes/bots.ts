import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { botSaves } from "../db/schema.js";
import { auth } from "../auth.js";

type Env = { Variables: { userId: string } };

export const botsRouter = new Hono<Env>();

botsRouter.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  c.set("userId", session.user.id);
  await next();
});

botsRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const rows = await db
    .select({ id: botSaves.id, name: botSaves.name, createdAt: botSaves.createdAt, updatedAt: botSaves.updatedAt })
    .from(botSaves)
    .where(eq(botSaves.userId, userId))
    .orderBy(botSaves.updatedAt);
  return c.json(rows);
});

botsRouter.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const [row] = await db.select().from(botSaves).where(and(eq(botSaves.id, id), eq(botSaves.userId, userId)));
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

botsRouter.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ name?: string; code?: string }>();
  const name = typeof body.name === "string" ? body.name.slice(0, 100) : "Bot";
  const code = typeof body.code === "string" ? body.code : "";

  const [row] = await db
    .insert(botSaves)
    .values({ userId, name, code })
    .returning({ id: botSaves.id });

  return c.json({ id: row!.id }, 201);
});

botsRouter.put("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string; code?: string }>();
  const updates: Partial<typeof botSaves.$inferInsert> = { updatedAt: new Date() };

  if (typeof body.name === "string") updates.name = body.name.slice(0, 100);
  if (typeof body.code === "string") updates.code = body.code;

  const rows = await db
    .update(botSaves)
    .set(updates)
    .where(and(eq(botSaves.id, id), eq(botSaves.userId, userId)))
    .returning({ id: botSaves.id });

  if (rows.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

botsRouter.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const rows = await db
    .delete(botSaves)
    .where(and(eq(botSaves.id, id), eq(botSaves.userId, userId)))
    .returning({ id: botSaves.id });

  if (rows.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});
