// The capture transports (002 research R8, FR-037, contracts/email.md "Capture file"). Neither
// opens a network connection. They hold links by design and exist only outside production.

import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { EmailTransport, OutgoingEmail } from "./transport.ts";

/** data-model.md §8: the message, its one link, and when it was captured. */
export interface CapturedEmail extends OutgoingEmail {
  readonly link: string;
  readonly at: string;
}

const LINK = /https?:\/\/\S+/;

function capture(message: OutgoingEmail, at: Date): CapturedEmail {
  const link = LINK.exec(message.text)?.[0];
  if (link === undefined) {
    throw new Error("A captured email must contain its link");
  }
  const { to, kind, subject, text, html } = message;
  return { to, kind, subject, text, html, link, at: at.toISOString() };
}

/** Keeps every message in memory, for tests and for a stack without EMAIL_CAPTURE_DIR. */
export class MemoryCapture implements EmailTransport {
  readonly messages: CapturedEmail[] = [];
  readonly #now: () => Date;

  constructor(now: () => Date = () => new Date()) {
    this.#now = now;
  }

  send(message: OutgoingEmail): Promise<void> {
    return Promise.resolve().then(() => {
      this.messages.push(capture(message, this.#now()));
    });
  }
}

/** One JSON file per message, `<iso-time>-<kind>-<n>.json`, under EMAIL_CAPTURE_DIR. */
export class FileCapture implements EmailTransport {
  readonly #dir: string;
  readonly #now: () => Date;
  #count = 0;

  constructor(dir: string, now: () => Date = () => new Date()) {
    this.#dir = dir;
    this.#now = now;
  }

  async send(message: OutgoingEmail): Promise<void> {
    const record = capture(message, this.#now());
    this.#count += 1;
    const name = `${record.at}-${record.kind}-${String(this.#count)}.json`;
    await mkdir(this.#dir, { recursive: true });
    // Readers look for `.json` only, so they never see a half-written file.
    const partial = join(this.#dir, `.${name}.partial`);
    await writeFile(partial, `${JSON.stringify(record)}\n`, { flag: "wx" });
    await rename(partial, join(this.#dir, name));
  }
}
