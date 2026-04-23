CREATE TABLE "tutorial_progress" (
	"user_id" text PRIMARY KEY NOT NULL,
	"challenge_index" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tutorial_progress" ADD CONSTRAINT "tutorial_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;