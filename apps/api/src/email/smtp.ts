// The production transport (002 research R8): nodemailer built only from the T002 SMTP config.
// The credentials leave their Secrets only here, when the transport is created. Nothing here
// logs: the recipient, the link and the credentials never reach a log line.

import { createTransport } from "nodemailer";
import type { EmailTransportConfig } from "../config.ts";
import type { EmailTransport, OutgoingEmail } from "./transport.ts";

type SmtpConfig = Extract<EmailTransportConfig, { kind: "smtp" }>;

export interface SmtpOptions {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly requireTLS: true;
  readonly auth: { readonly user: string; readonly pass: string };
}

interface Mailer {
  sendMail(mail: Omit<OutgoingEmail, "kind"> & { readonly from: string }): Promise<unknown>;
}

export type CreateMailer = (options: SmtpOptions) => Mailer;

const nodemailerMailer: CreateMailer = (options) =>
  createTransport({ ...options, auth: { ...options.auth } });

export function smtpTransport(
  config: SmtpConfig,
  from: string,
  createMailer: CreateMailer = nodemailerMailer,
): EmailTransport {
  const mailer = createMailer({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTLS,
    auth: { user: config.user.reveal(), pass: config.password.reveal() },
  });
  return {
    async send(message) {
      const { to, subject, text, html } = message;
      await mailer.sendMail({ from, to, subject, text, html });
    },
  };
}
