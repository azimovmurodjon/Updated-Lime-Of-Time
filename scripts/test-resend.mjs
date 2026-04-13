// Test Resend API key validity
const key = process.env.RESEND_API_KEY;
if (!key) {
  console.error("RESEND_API_KEY not set");
  process.exit(1);
}
console.log("Key present:", !!key, "starts with re_:", key.startsWith("re_"));

try {
  const response = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = await response.json();
  if (response.ok) {
    const domains = data.data?.map((x) => x.name) ?? [];
    console.log("✅ Resend API key valid! Domains:", domains);
    const hasLimeOfTime = domains.some((d) => d.includes("lime-of-time.com"));
    console.log("lime-of-time.com domain present:", hasLimeOfTime);
  } else {
    console.error("❌ Resend API error:", response.status, JSON.stringify(data));
    process.exit(1);
  }
} catch (err) {
  console.error("❌ Network error:", err.message);
  process.exit(1);
}
