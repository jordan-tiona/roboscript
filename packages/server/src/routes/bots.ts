import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { botSlots } from "../db/schema.js";
import { auth } from "../auth.js";

type Env = { Variables: { userId: string } };

const MAX_SLOTS = 5;

export const botsRouter = new Hono<Env>();

botsRouter.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  c.set("userId", session.user.id);
  await next();
});

// Return all 5 slots; unset slots come back with empty defaults.
botsRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const rows = await db.select().from(botSlots).where(eq(botSlots.userId, userId));

  const slots = Array.from({ length: MAX_SLOTS }, (_, i) => {
    const row = rows.find((r) => r.slotIndex === i);
    return row
      ? { slotIndex: i, name: row.name, code: row.code, updatedAt: row.updatedAt }
      : { slotIndex: i, name: `Bot ${i + 1}`, code: "", updatedAt: null };
  });

  return c.json(slots);
});

// Upsert a single slot by index (0–4).
botsRouter.put("/:index", async (c) => {
  const userId = c.get("userId");
  const index = Number(c.req.param("index"));

  if (!Number.isInteger(index) || index < 0 || index >= MAX_SLOTS) {
    return c.json({ error: "Slot index must be 0–4" }, 400);
  }

  const body = await c.req.json<{ name?: string; code?: string }>();
  const name = typeof body.name === "string" ? body.name.slice(0, 50) : `Bot ${index + 1}`;
  const code = typeof body.code === "string" ? body.code : "";

  await db
    .insert(botSlots)
    .values({ userId, slotIndex: index, name, code, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [botSlots.userId, botSlots.slotIndex],
      set: { name, code, updatedAt: new Date() },
    });

  return c.json({ ok: true });
});
