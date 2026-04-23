import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { user, tutorialProgress } from "../db/schema.js";
import { auth } from "../auth.js";

type Env = { Variables: { userId: string } };

export const profileRouter = new Hono<Env>();

profileRouter.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  c.set("userId", session.user.id);
  await next();
});

profileRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const [row] = await db.select({ id: user.id, name: user.name, email: user.email })
    .from(user).where(eq(user.id, userId));
  if (!row) return c.json({ error: "Not found" }, 404);

  const [progress] = await db.select({ challengeIndex: tutorialProgress.challengeIndex })
    .from(tutorialProgress).where(eq(tutorialProgress.userId, userId));

  return c.json({ ...row, challengeIndex: progress?.challengeIndex ?? 0 });
});

profileRouter.post("/reset-tutorial", async (c) => {
  const userId = c.get("userId");
  await db
    .insert(tutorialProgress)
    .values({ userId, challengeIndex: 0, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: tutorialProgress.userId,
      set: { challengeIndex: 0, updatedAt: new Date() },
    });
  return c.json({ ok: true });
});

profileRouter.post("/advance-challenge", async (c) => {
  const userId = c.get("userId");
  const [current] = await db.select({ challengeIndex: tutorialProgress.challengeIndex })
    .from(tutorialProgress).where(eq(tutorialProgress.userId, userId));
  const next = (current?.challengeIndex ?? 0) + 1;
  await db
    .insert(tutorialProgress)
    .values({ userId, challengeIndex: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: tutorialProgress.userId,
      set: { challengeIndex: next, updatedAt: new Date() },
    });
  return c.json({ challengeIndex: next });
});
