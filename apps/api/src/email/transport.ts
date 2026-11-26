// The one email interface (002 research R8, FR-037) and the choice of transport. SMTP only when
// the config names it, which loadConfig allows in production alone (FR-038); otherwise the file
// capture when EMAIL_CAPTURE_DIR is set, otherwise the in-memory capture.

import type { ApiAuthConfig } from "../config.ts";
import { FileCapture, MemoryCapture } from "./capture.ts";
import { smtpTransport, type CreateMailer } from "./smtp.ts";

export type EmailKind = "invite" | "sign_in";

/** data-model.md §8. */
export interface OutgoingEmail {
  readonly to: string;
  readonly kind: EmailKind;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export interface EmailTransport {
  send(message: OutgoingEmail): Promise<void>;
}

export interface TransportDeps {
  /** Replaces nodemailer's `createTransport` (tests). */
  readonly createMailer?: CreateMailer;
}

export function createEmailTransport(
  auth: ApiAuthConfig,
  deps: TransportDeps = {},
): EmailTransport {
  const config = auth.emailTransport;
  if (config.kind === "smtp") {
    return smtpTransport(config, auth.emailFrom, deps.createMailer);
  }
  return config.dir === undefined ? new MemoryCapture() : new FileCapture(config.dir);
}
