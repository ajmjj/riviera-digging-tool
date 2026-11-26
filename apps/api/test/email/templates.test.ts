import { describe, expect, it } from "vitest";
import { renderEmail, type LinkEmail } from "../../src/email/templates.ts";
import type { OutgoingEmail } from "../../src/email/transport.ts";

const link = "http://localhost:8080/sign-in/confirm#t=rdl_example";
const base = { to: "mia@example.test", name: "Mia", link } as const;
const cases = [
  { kind: "invite", subject: "You're invited to Riviera Dig", lifetime: "valid for 7 days" },
  { kind: "sign_in", subject: "Your Riviera Dig sign-in link", lifetime: "valid for 15 minutes" },
] as const;

/** The parts the reader sees; the HTML is unescaped back to its text so both read alike. */
function parts(email: OutgoingEmail): readonly string[] {
  return [email.text, email.html.replaceAll("&#39;", "'")];
}

function render(input: Partial<LinkEmail> & Pick<LinkEmail, "kind">): OutgoingEmail {
  return renderEmail({ ...base, ...input });
}

describe("email templates", () => {
  it.each(cases)(
    "002/FR-039: $kind carries its subject, the name, the link, $lifetime and the ignore line",
    ({ kind, subject, lifetime }) => {
      const email = render({ kind });
      expect(email).toMatchObject({ to: base.to, kind, subject });
      for (const part of parts(email)) {
        expect(part).toContain("Hi Mia,");
        expect(part).toContain(link);
        expect(part).toContain(lifetime);
        expect(part).toContain("If you didn't expect this email, you can ignore it.");
      }
    },
  );

  it.each(cases)("002/FR-039: $kind has no staff ID, no other link and no image", ({ kind }) => {
    const email = render({ kind });
    for (const part of parts(email)) {
      expect(part).not.toMatch(/stf_/);
      expect(part.match(/https?:\/\/[^\s"<]+/g)?.filter((url) => url !== link)).toEqual([]);
      expect(part).not.toMatch(/<img|src=|url\(/i);
    }
    expect(email.html.match(/<a /g)).toHaveLength(1);
  });

  it.each(cases)(
    "002/FR-039: $kind escapes the name in HTML and keeps it out of the subject",
    ({ kind }) => {
      const name = `<script>alert("x")</script> & 'Mia'`;
      const email = render({ kind, name });
      expect(email.text).toContain(`Hi ${name},`);
      expect(email.html).toContain(
        "Hi &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;Mia&#39;,",
      );
      expect(email.html).not.toContain("<script");
      expect(email.subject).not.toMatch(/script|Mia/);
      expect(render({ kind, name: "Mia" }).subject).not.toContain("Mia");
    },
  );
});
