import { Hono } from "hono";
import { and, asc, desc, eq, gte, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { botSaves, ladderEntries, ladderMatches, user } from "../db/schema.js";
import { auth } from "../auth.js";
import { runMatch } from "../game/matchRunner.js";

type Env = { Variables: { userId: string } };

export const ladderRouter = new Hono<Env>();

const FREE_MATCHES_PER_DAY = 12;

ladderRouter.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  c.set("userId", session.user.id);
  await next();
});

// GET /api/ladder — leaderboard (top 50)
ladderRouter.get("/", async (c) => {
  const rows = await db
    .select({
      id: ladderEntries.id,
      userId: ladderEntries.userId,
      userName: user.name,
      botSaveId: ladderEntries.botSaveId,
      rating: ladderEntries.rating,
      wins: ladderEntries.wins,
      losses: ladderEntries.losses,
      ties: ladderEntries.ties,
    })
    .from(ladderEntries)
    .innerJoin(user, eq(ladderEntries.userId, user.id))
    .orderBy(desc(ladderEntries.rating))
    .limit(50);

  return c.json(rows);
});

// GET /api/ladder/me — current user's entry + match count today
ladderRouter.get("/me", async (c) => {
  const userId = c.get("userId");

  const [entry] = await db
    .select()
    .from(ladderEntries)
    .where(eq(ladderEntries.userId, userId));

  if (!entry) return c.json(null);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ladderMatches)
    .where(
      and(
        or(eq(ladderMatches.entryAId, entry.id), eq(ladderMatches.entryBId, entry.id)),
        gte(ladderMatches.createdAt, since),
      ),
    );
  const matchesToday = countResult[0]?.count ?? 0;

  return c.json({ ...entry, matchesToday, dailyLimit: FREE_MATCHES_PER_DAY });
});

// POST /api/ladder/enter — enter or update bot on the ladder
ladderRouter.post("/enter", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ botSaveId: string }>();

  if (typeof body.botSaveId !== "string") {
    return c.json({ error: "botSaveId required" }, 400);
  }

  // Verify bot belongs to user
  const [bot] = await db
    .select({ id: botSaves.id })
    .from(botSaves)
    .where(and(eq(botSaves.id, body.botSaveId), eq(botSaves.userId, userId)));

  if (!bot) return c.json({ error: "Bot not found" }, 404);

  // Upsert ladder entry (reset rating only on first enter; update keeps existing rating)
  const [existing] = await db
    .select({ id: ladderEntries.id })
    .from(ladderEntries)
    .where(eq(ladderEntries.userId, userId));

  if (existing) {
    await db
      .update(ladderEntries)
      .set({ botSaveId: body.botSaveId, updatedAt: new Date() })
      .where(eq(ladderEntries.userId, userId));
    return c.json({ id: existing.id });
  } else {
    const [row] = await db
      .insert(ladderEntries)
      .values({ userId, botSaveId: body.botSaveId })
      .returning({ id: ladderEntries.id });
    return c.json({ id: row!.id }, 201);
  }
});

// GET /api/ladder/matches — match history for current user (most recent first)
ladderRouter.get("/matches", async (c) => {
  const userId = c.get("userId");
  const limitParam = Number(c.req.query("limit") ?? "20");
  const offsetParam = Number(c.req.query("offset") ?? "0");
  const limit = Math.min(Math.max(1, limitParam), 100);
  const offset = Math.max(0, offsetParam);

  const [entry] = await db
    .select({ id: ladderEntries.id })
    .from(ladderEntries)
    .where(eq(ladderEntries.userId, userId));

  if (!entry) return c.json([]);

  const rows = await db
    .select({
      id: ladderMatches.id,
      entryAId: ladderMatches.entryAId,
      entryBId: ladderMatches.entryBId,
      winnerId: ladderMatches.winnerId,
      ratingDelta: ladderMatches.ratingDelta,
      durationTicks: ladderMatches.durationTicks,
      createdAt: ladderMatches.createdAt,
      permanent: ladderMatches.permanent,
    })
    .from(ladderMatches)
    .where(or(eq(ladderMatches.entryAId, entry.id), eq(ladderMatches.entryBId, entry.id)))
    .orderBy(desc(ladderMatches.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json(rows);
});

// GET /api/ladder/matches/:id — single match with replay
ladderRouter.get("/matches/:id", async (c) => {
  const userId = c.get("userId");
  const matchId = c.req.param("id");

  const [entry] = await db
    .select({ id: ladderEntries.id })
    .from(ladderEntries)
    .where(eq(ladderEntries.userId, userId));

  if (!entry) return c.json({ error: "Not found" }, 404);

  const [match] = await db
    .select()
    .from(ladderMatches)
    .where(
      and(
        eq(ladderMatches.id, matchId),
        or(eq(ladderMatches.entryAId, entry.id), eq(ladderMatches.entryBId, entry.id)),
      ),
    );

  if (!match) return c.json({ error: "Not found" }, 404);
  return c.json(match);
});

// POST /api/ladder/challenge — trigger a match against a random opponent
ladderRouter.post("/challenge", async (c) => {
  const userId = c.get("userId");

  const [myEntry] = await db
    .select()
    .from(ladderEntries)
    .where(eq(ladderEntries.userId, userId));

  if (!myEntry) return c.json({ error: "You must enter the ladder first" }, 400);

  // Enforce daily match limit
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const todayResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ladderMatches)
    .where(
      and(
        or(eq(ladderMatches.entryAId, myEntry.id), eq(ladderMatches.entryBId, myEntry.id)),
        gte(ladderMatches.createdAt, since),
      ),
    );
  const matchesToday = todayResult[0]?.count ?? 0;

  if (matchesToday >= FREE_MATCHES_PER_DAY) {
    return c.json({ error: "Daily match limit reached" }, 429);
  }

  // Find a random opponent (closest rating within a band, else random)
  const opponents = await db
    .select()
    .from(ladderEntries)
    .where(and(
      sql`${ladderEntries.userId} != ${userId}`,
    ))
    .orderBy(asc(sql`abs(${ladderEntries.rating} - ${myEntry.rating})`))
    .limit(10);

  if (opponents.length === 0) {
    return c.json({ error: "No opponents available yet" }, 404);
  }

  const opponent = opponents[Math.floor(Math.random() * Math.min(opponents.length, 5))]!;

  // Load both bots' code
  const [myBot] = await db
    .select({ code: botSaves.code, name: botSaves.name })
    .from(botSaves)
    .where(eq(botSaves.id, myEntry.botSaveId));

  const [opponentBot] = await db
    .select({ code: botSaves.code, name: botSaves.name })
    .from(botSaves)
    .where(eq(botSaves.id, opponent.botSaveId));

  if (!myBot || !opponentBot) {
    return c.json({ error: "Bot code not found" }, 500);
  }

  // Run the match
  const result = await runMatch(
    { id: myEntry.id, name: myBot.name, code: myBot.code, rating: myEntry.rating, entryId: myEntry.id },
    { id: opponent.id, name: opponentBot.name, code: opponentBot.code, rating: opponent.rating, entryId: opponent.id },
  );

  // Update ratings
  const myWon     = result.winnerEntryId === myEntry.id;
  const opponentWon = result.winnerEntryId === opponent.id;
  const isDraw    = result.winnerEntryId === null;

  await db
    .update(ladderEntries)
    .set({
      rating: myEntry.rating + (myWon ? result.ratingDelta : isDraw ? 0 : -result.ratingDelta),
      wins:   myEntry.wins   + (myWon  ? 1 : 0),
      losses: myEntry.losses + (opponentWon ? 1 : 0),
      ties:   myEntry.ties   + (isDraw  ? 1 : 0),
      lastMatchAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(ladderEntries.id, myEntry.id));

  await db
    .update(ladderEntries)
    .set({
      rating: opponent.rating + (opponentWon ? result.ratingDelta : isDraw ? 0 : -result.ratingDelta),
      wins:   opponent.wins   + (opponentWon ? 1 : 0),
      losses: opponent.losses + (myWon ? 1 : 0),
      ties:   opponent.ties   + (isDraw  ? 1 : 0),
      lastMatchAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(ladderEntries.id, opponent.id));

  // Save match record
  const [savedMatch] = await db
    .insert(ladderMatches)
    .values({
      entryAId: myEntry.id,
      entryBId: opponent.id,
      winnerId: result.winnerEntryId,
      ratingDelta: result.ratingDelta,
      durationTicks: result.durationTicks,
      replay: result.replay,
    })
    .returning({ id: ladderMatches.id });

  return c.json({
    matchId: savedMatch!.id,
    won: myWon,
    draw: isDraw,
    ratingChange: myWon ? result.ratingDelta : isDraw ? 0 : -result.ratingDelta,
    durationTicks: result.durationTicks,
    opponentName: opponentBot.name,
  });
});
