import { createLogger } from "@riviera/telemetry/logger";
import { describe, expect, it } from "vitest";
import { MemoryCapture } from "../../src/email/capture.ts";
import { createEmailSender } from "../../src/email/sender.ts";
import type { EmailTransport, OutgoingEmail } from "../../src/email/transport.ts";

// Built at runtime, so the planted address is never a literal the scan could miss.
const planted = ["planted", "k3v9", "address"].join("-") + "@example.test";
const message: OutgoingEmail = {
  to: planted,
  kind: "sign_in",
  subject: "Your Riviera Dig sign-in link",
  text: `Hi Mia,\n\nhttp://localhost:8080/sign-in/confirm#t=rdl_example\n`,
  html: "<p>Hi Mia,</p>",
};

function setup(transport: EmailTransport) {
  const lines: string[] = [];
  const log = createLogger({
    service: "riviera-api",
    env: "ci",
    level: "info",
    write: (line) => lines.push(line),
  });
  return { sender: createEmailSender(transport, log), lines };
}

const failing = (reason: Error): EmailTransport => ({ send: () => Promise.reject(reason) });

describe("email sender", () => {
  it("002/FR-037: sendNow answers sent, or failed without throwing", async () => {
    const capture = new MemoryCapture();
    expect(await setup(capture).sender.sendNow(message)).toBe("sent");
    expect(capture.messages).toHaveLength(1);
    expect(await setup(failing(new Error("refused"))).sender.sendNow(message)).toBe("failed");
  });

  it("002/FR-037: a background failure is logged without the address and never rejects", async () => {
    const { sender, lines } = setup(failing(new Error(`550 mailbox ${planted} unavailable`)));
    sender.sendInBackground(message);
    sender.sendInBackground(message);
    await sender.idle();
    const output = lines.join("");
    expect(output).not.toContain(planted);
    expect(output).not.toContain("rdl_example");
    const failures = lines.map((line): unknown => JSON.parse(line));
    expect(failures).toHaveLength(2);
    expect(failures[0]).toMatchObject({
      level: "error",
      msg: "email send failed",
      email_kind: "sign_in",
    });
  });
});
