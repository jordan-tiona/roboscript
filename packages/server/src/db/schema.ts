import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ── better-auth required tables ───────────────────────────────────────────────

export const user = pgTable("user", {
  id:            text("id").primaryKey(),
  name:          text("name").notNull(),
  email:         text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image:         text("image"),
  createdAt:     timestamp("created_at").notNull(),
  updatedAt:     timestamp("updated_at").notNull(),
});

export const session = pgTable("session", {
  id:        text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token:     text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId:    text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id:                     text("id").primaryKey(),
  accountId:              text("account_id").notNull(),
  providerId:             text("provider_id").notNull(),
  userId:                 text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken:            text("access_token"),
  refreshToken:           text("refresh_token"),
  idToken:                text("id_token"),
  accessTokenExpiresAt:   timestamp("access_token_expires_at"),
  refreshTokenExpiresAt:  timestamp("refresh_token_expires_at"),
  scope:                  text("scope"),
  password:               text("password"),
  createdAt:              timestamp("created_at").notNull(),
  updatedAt:              timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id:         text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value:      text("value").notNull(),
  expiresAt:  timestamp("expires_at").notNull(),
  createdAt:  timestamp("created_at"),
  updatedAt:  timestamp("updated_at"),
});

// ── Application tables ────────────────────────────────────────────────────────

export const botSaves = pgTable("bot_saves", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name:      text("name").notNull().default("Bot"),
  code:      text("code").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tutorialProgress = pgTable("tutorial_progress", {
  userId:         text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  challengeIndex: integer("challenge_index").notNull().default(0),
  updatedAt:      timestamp("updated_at").notNull().defaultNow(),
});

// ── Ladder ────────────────────────────────────────────────────────────────────

/** The bot a user has entered into the ladder (one active entry per user). */
export const ladderEntries = pgTable("ladder_entries", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    text("user_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
  botSaveId: uuid("bot_save_id").notNull().references(() => botSaves.id, { onDelete: "cascade" }),
  rating:    real("rating").notNull().default(1000),
  wins:      integer("wins").notNull().default(0),
  losses:    integer("losses").notNull().default(0),
  ties:      integer("ties").notNull().default(0),
  /** Timestamp of the last match played — used to enforce per-bot match cooldown. */
  lastMatchAt: timestamp("last_match_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Result of a completed ladder match. */
export const ladderMatches = pgTable("ladder_matches", {
  id:          uuid("id").primaryKey().defaultRandom(),
  entryAId:    uuid("entry_a_id").notNull().references(() => ladderEntries.id),
  entryBId:    uuid("entry_b_id").notNull().references(() => ladderEntries.id),
  /** null = tie */
  winnerId:    uuid("winner_id"),
  ratingDelta: real("rating_delta").notNull(), // absolute change applied to winner (loser gets negative)
  /** Keyframe-compressed replay: array of sampled GameState snapshots (every Nth tick) + event log. */
  replay:      jsonb("replay"),
  /** How many ticks the match lasted. */
  durationTicks: integer("duration_ticks").notNull(),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  /** Permanent saves are kept indefinitely; otherwise culled after retention window. */
  permanent:   boolean("permanent").notNull().default(false),
});
