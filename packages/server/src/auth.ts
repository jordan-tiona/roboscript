import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db/index.js";
import { sendMail } from "./email.js";

export const auth = betterAuth({
  baseURL: process.env["BETTER_AUTH_URL"] ?? "http://localhost:8080/api/auth",
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    sendResetPassword: async ({ user, url }) => {
      await sendMail(
        user.email,
        "Reset your RoboScript password",
        `<p>Hi ${user.name},</p>
<p>Click the link below to reset your password. This link expires in 1 hour.</p>
<p><a href="${url}">${url}</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>`,
      );
    },
  },
  trustedOrigins: [process.env["CLIENT_ORIGIN"] ?? "http://localhost:5173"],
  secret: process.env["BETTER_AUTH_SECRET"],
});
