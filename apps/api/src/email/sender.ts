// Sending (002 research R6). `sendNow` is what the admin flows await: it answers `sent` or
// `failed` and never throws. `sendInBackground` is the in-process promise chain the sign-in
// request hands its email to after answering; it never rejects. Neither is the job queue, whose
// payload would store the link in plain text (FR-004). Log lines carry the email's kind only: never
// the address, the link, or the error, whose message an SMTP server may fill with the recipient
// (FR-040).

import type { EmailTransport, OutgoingEmail } from "./transport.ts";

type SendOutcome = "sent" | "failed";

interface SendLog {
  info(fields: object, msg: string): void;
  error(fields: object, msg: string): void;
}

export interface EmailSender {
  sendNow(message: OutgoingEmail): Promise<SendOutcome>;
  sendInBackground(message: OutgoingEmail): void;
  /** Resolves once every background send handed over so far has finished. */
  idle(): Promise<void>;
}

const settle = (): undefined => undefined;

export function createEmailSender(transport: EmailTransport, log: SendLog): EmailSender {
  let chain: Promise<void> = Promise.resolve();

  async function sendNow(message: OutgoingEmail): Promise<SendOutcome> {
    try {
      await transport.send(message);
    } catch {
      log.error({ email_kind: message.kind }, "email send failed");
      return "failed";
    }
    log.info({ email_kind: message.kind }, "email sent");
    return "sent";
  }

  return {
    sendNow,
    sendInBackground(message) {
      chain = chain.then(() => sendNow(message)).then(settle, settle);
    },
    idle: () => chain,
  };
}
