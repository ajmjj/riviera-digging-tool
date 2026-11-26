import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig, type ApiAuthConfig } from "../../src/config.ts";
import { FileCapture, MemoryCapture } from "../../src/email/capture.ts";
import type { CreateMailer, SmtpOptions } from "../../src/email/smtp.ts";
import { renderEmail } from "../../src/email/templates.ts";
import { createEmailTransport, type OutgoingEmail } from "../../src/email/transport.ts";

const link = "http://localhost:8080/sign-in/confirm#t=rdl_example";
const message: OutgoingEmail = {
  to: "mia@example.test",
  kind: "invite",
  subject: "You're invited to Riviera Dig",
  text: `Hi Mia,\n\n${link}\n`,
  html: `<p><a href="${link}">${link}</a></p>`,
};
const at = new Date("2026-11-25T10:00:00.000Z");

function apiAuth(env: Record<string, string>): ApiAuthConfig {
  const auth = loadConfig(
    {
      APP_URL: "https://dig.rivierarecords.de",
      DATABASE_URL: "postgres://u:p@db/riviera",
      SESSION_SECRET: "test-session-secret-0123456789abcdef",
      ...env,
    },
    "api",
  ).apiAuth;
  if (auth === undefined) {
    throw new Error("the api role always has apiAuth");
  }
  return auth;
}

const production = {
  SMTP_URL: "smtps://dig%40rivierarecords.de:smtp-pass@smtp.ionos.de:465",
  EMAIL_FROM: "dig@rivierarecords.de",
};

function fakeMailer() {
  const created: SmtpOptions[] = [];
  const sent: unknown[] = [];
  const create: CreateMailer = (options) => {
    created.push(options);
    return { sendMail: (mail) => Promise.resolve(sent.push(mail)) };
  };
  return { create, created, sent };
}

describe("email transports", () => {
  let dir: string;
  const connect = vi.spyOn(Socket.prototype, "connect");
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "riviera-mail-"));
    connect.mockClear();
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    expect(connect).not.toHaveBeenCalled();
  });

  it("002/FR-037: the in-memory capture stores the message with its link and sends nothing", async () => {
    const capture = new MemoryCapture(() => at);
    await capture.send(message);
    expect(capture.messages).toEqual([{ ...message, link, at: at.toISOString() }]);
    await expect(capture.send({ ...message, html: "<p>no link</p>" })).rejects.toThrow(/its link/);
  });

  it("002/FR-037: the captured link is the email's own, even when the name holds a URL", async () => {
    const capture = new MemoryCapture(() => at);
    const name = "Mia http://elsewhere.example/?a=1&b=2";
    const tricky = `${link}&x="y"`;
    await capture.send(renderEmail({ to: message.to, kind: "invite", name, link: tricky }));
    expect(capture.messages.map((captured) => captured.link)).toEqual([tricky]);
  });

  it("002/FR-037: the file capture writes one <iso-time>-<kind>-<n>.json file per message", async () => {
    const capture = new FileCapture(join(dir, "mail"), () => at);
    await capture.send(message);
    await capture.send({ ...message, kind: "sign_in" });
    const files = await readdir(join(dir, "mail"));
    expect(files.sort()).toEqual([
      "2026-11-25T10:00:00.000Z-invite-1.json",
      "2026-11-25T10:00:00.000Z-sign_in-2.json",
    ]);
    const [first = ""] = files;
    const record: unknown = JSON.parse(await readFile(join(dir, "mail", first), "utf8"));
    expect(record).toStrictEqual({ ...message, link, at: "2026-11-25T10:00:00.000Z" });
  });

  it("002/FR-037: the SMTP transport is built from the production config alone", async () => {
    const fake = fakeMailer();
    const transport = createEmailTransport(apiAuth(production), { createMailer: fake.create });
    expect(fake.created).toEqual([
      {
        host: "smtp.ionos.de",
        port: 465,
        secure: true,
        requireTLS: true,
        auth: { user: "dig@rivierarecords.de", pass: "smtp-pass" },
      },
    ]);
    await transport.send(message);
    const { to, subject, text, html } = message;
    expect(fake.sent).toEqual([{ from: "dig@rivierarecords.de", to, subject, text, html }]);
  });

  it("002/FR-037: the real nodemailer transport is created without connecting", () => {
    expect(createEmailTransport(apiAuth(production))).toHaveProperty("send");
  });

  it("002/FR-038: outside production the capture is chosen, file with a dir, memory without", async () => {
    const fake = fakeMailer();
    const createMailer = fake.create;
    const ci = { DEPLOYMENT_ENVIRONMENT: "ci" };
    const withDir = createEmailTransport(apiAuth({ ...ci, EMAIL_CAPTURE_DIR: dir }), {
      createMailer,
    });
    expect(withDir).toBeInstanceOf(FileCapture);
    await withDir.send(message);
    expect(await readdir(dir)).toHaveLength(1);
    expect(createEmailTransport(apiAuth(ci), { createMailer })).toBeInstanceOf(MemoryCapture);
    expect(fake.created).toEqual([]);
  });
});
