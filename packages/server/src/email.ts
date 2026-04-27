import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env["SMTP_HOST"],
  port: parseInt(process.env["SMTP_PORT"] ?? "587"),
  secure: process.env["SMTP_SECURE"] === "true",
  auth: {
    user: process.env["SMTP_USER"],
    pass: process.env["SMTP_PASS"],
  },
});

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  await transporter.sendMail({ from: "roboscript@purelymail.com", to, subject, html });
}
