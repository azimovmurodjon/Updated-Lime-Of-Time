import { describe, it, expect } from "vitest";

describe("Resend API Key Validation", () => {
  it("should have RESEND_API_KEY set", () => {
    expect(process.env.RESEND_API_KEY).toBeDefined();
    expect(process.env.RESEND_API_KEY).toMatch(/^re_/);
  });

  it("should be able to authenticate with Resend API", async () => {
    const res = await fetch("https://api.resend.com/domains", {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toBeDefined();
    // Verify lime-of-time.com is in the verified domains
    const domains = data.data.map((d: any) => d.name);
    expect(domains).toContain("lime-of-time.com");
  });
});
