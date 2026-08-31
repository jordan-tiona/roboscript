CREATE TABLE "ladder_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"bot_save_id" uuid NOT NULL,
	"rating" real DEFAULT 1000 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"ties" integer DEFAULT 0 NOT NULL,
	"last_match_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ladder_entries_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "ladder_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_a_id" uuid NOT NULL,
	"entry_b_id" uuid NOT NULL,
	"winner_id" uuid,
	"rating_delta" real NOT NULL,
	"replay" jsonb,
	"duration_ticks" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"permanent" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ladder_entries" ADD CONSTRAINT "ladder_entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ladder_entries" ADD CONSTRAINT "ladder_entries_bot_save_id_bot_saves_id_fk" FOREIGN KEY ("bot_save_id") REFERENCES "public"."bot_saves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ladder_matches" ADD CONSTRAINT "ladder_matches_entry_a_id_ladder_entries_id_fk" FOREIGN KEY ("entry_a_id") REFERENCES "public"."ladder_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ladder_matches" ADD CONSTRAINT "ladder_matches_entry_b_id_ladder_entries_id_fk" FOREIGN KEY ("entry_b_id") REFERENCES "public"."ladder_entries"("id") ON DELETE no action ON UPDATE no action;