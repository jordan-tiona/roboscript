import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db/index.js";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  trustedOrigins: [process.env["CLIENT_ORIGIN"] ?? "http://localhost:5173"],
  secret: process.env["BETTER_AUTH_SECRET"],
});
