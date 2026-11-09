// Internal utility, not a remotely callable Server Action.
import { createTransport } from "nodemailer";

import { domainPrisma } from "../utils/domainPrisma";

// Reset links must be absolute and point at this application. A missing or
// malformed origin never produces a relative or attacker-shaped link.
function resetLinkOrigin(baseUrl?: string): string {
  const configured = baseUrl || process.env.SMTP_STORE_LINK || "";
  let url: URL;
  try { url = new URL(configured); } catch { throw new Error("Email delivery unavailable."); }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && local)) || url.username || url.password) {
    throw new Error("Email delivery unavailable.");
  }
  return url.origin;
}

// Staff (dashboard access or an active shop membership) reset in the dashboard;
// everyone else is a storefront customer and resets from their account page.
async function resetPathFor(email: string): Promise<string> {
  const user = await domainPrisma.user.findUnique({
    where: { email },
    select: {
      role: { select: { canAccessDashboard: true } },
      shopMemberships: { where: { status: "active" }, select: { id: true }, take: 1 },
    },
  });
  return user?.role?.canAccessDashboard || user?.shopMemberships?.length ? "/dashboard/reset" : "/account/reset";
}

function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mailTransport() {
  const { SMTP_HOST: host, SMTP_USER: user, SMTP_PASSWORD: pass } = process.env;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  if (!host || !user || !pass || (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535))) throw new Error('Email delivery unavailable.');
  return createTransport({ host, port, auth: { user, pass }, disableFileAccess: true, disableUrlAccess: true });
}

function passwordResetEmail({ url }: { url: string }): string {
  const backgroundColor = "#f9f9f9";
  const textColor = "#444444";
  const mainBackgroundColor = "#ffffff";
  const buttonBackgroundColor = "#346df1";
  const buttonBorderColor = "#346df1";
  const buttonTextColor = "#ffffff";

  return `
    <body style="background: ${backgroundColor};">
      <table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: ${mainBackgroundColor}; max-width: 600px; margin: auto; border-radius: 10px;">
        <tr>
          <td align="center" style="padding: 10px 0px 0px 0px; font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            Please click below to reset your password
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="border-radius: 5px;" bgcolor="${buttonBackgroundColor}"><a href="${escapeHtmlAttribute(url)}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${buttonTextColor}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${buttonBorderColor}; display: inline-block; font-weight: bold;">Reset Password</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            If you did not request this email you can safely ignore it.
          </td>
        </tr>
      </table>
    </body>
  `;
}

export async function sendPasswordResetEmail(resetToken: string, to: string, baseUrl?: string): Promise<void> {
  const url = new URL(await resetPathFor(to), resetLinkOrigin(baseUrl));
  url.searchParams.set("token", resetToken);

  const info = await mailTransport().sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: "Reset your password",
    html: passwordResetEmail({ url: url.toString() }),
  });
  // A resolved send is not acceptance: require the server to accept this recipient.
  const accepted = ((info.accepted || []) as Array<string | { address?: string }>).map((entry) => String(typeof entry === "string" ? entry : entry.address || "").toLowerCase());
  if ((info.rejected || []).length || !accepted.includes(to.toLowerCase())) {
    throw new Error("The mail server did not accept the password reset email.");
  }
}
