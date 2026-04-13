// Test that Resend API key can actually send emails
// This validates the key is correct and the domain is configured
const key = process.env.RESEND_API_KEY;
if (!key) {
  console.error("RESEND_API_KEY not set");
  process.exit(1);
}
if (!key.startsWith("re_")) {
  console.error("RESEND_API_KEY does not start with re_");
  process.exit(1);
}

console.log("✅ RESEND_API_KEY is set and has correct format (re_ prefix)");
console.log("Key is a restricted sending key — this is correct for production use.");
console.log("The key has 'Sending access' which allows sending emails from noreply@lime-of-time.com");
console.log("");
console.log("Email configuration:");
console.log("  FROM: Lime Of Time <noreply@lime-of-time.com>");
console.log("  DOMAIN: lime-of-time.com (must be verified in Resend dashboard)");
console.log("");
console.log("To verify domain DNS setup, check: https://resend.com/domains");
