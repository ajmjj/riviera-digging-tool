// The invite and sign-in emails (002 contracts/email.md "Messages", FR-039): the name, the one
// link and its lifetime, and nothing else. The name is plain text, HTML-escaped and never in
// the subject (research R16). No staff ID, no other link, no image.

import type { EmailKind, OutgoingEmail } from "./transport.ts";

export interface LinkEmail {
  readonly to: string;
  readonly kind: EmailKind;
  readonly name: string;
  /** `${APP_URL}/sign-in/confirm#t=…` */
  readonly link: string;
}

const MESSAGES = {
  invite: {
    subject: "You're invited to Riviera Dig",
    lead: "You've been invited to Riviera Dig. Open this link to sign in for the first time:",
    lifetime: "7 days",
  },
  sign_in: {
    subject: "Your Riviera Dig sign-in link",
    lead: "Open this link to sign in to Riviera Dig:",
    lifetime: "15 minutes",
  },
} as const;

const IGNORE = "If you didn't expect this email, you can ignore it.";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderEmail({ to, kind, name, link }: LinkEmail): OutgoingEmail {
  const { subject, lead, lifetime } = MESSAGES[kind];
  const valid = `The link is valid for ${lifetime}.`;
  const text = [`Hi ${name},`, lead, link, valid, IGNORE].join("\n\n") + "\n";
  const href = escapeHtml(link);
  const html = [
    '<!doctype html><html lang="en"><body>',
    `<p>Hi ${escapeHtml(name)},</p>`,
    `<p>${escapeHtml(lead)}</p>`,
    `<p><a href="${href}">${href}</a></p>`,
    `<p>${escapeHtml(valid)}</p>`,
    `<p>${escapeHtml(IGNORE)}</p>`,
    "</body></html>",
  ].join("\n");
  return { to, kind, subject, text, html };
}
