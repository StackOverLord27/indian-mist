// Safety rail: Vitest does not load .env, but the shell might export real
// service credentials. Blank them and install harmless dummies so no test can
// reach Atlas, Upstash, Cloudinary, SMTP or Razorpay by accident.
const SCRUB = [
  "MONGODB_URI", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN",
  "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET",
  "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM",
  "MAIL_HOST", "MAIL_PORT", "MAIL_USER", "MAIL_PASS",
  "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "NEXT_PUBLIC_RAZORPAY_KEY_ID", "RAZORPAY_WEBHOOK_SECRET",
];
for (const k of SCRUB) delete process.env[k];

Object.assign(process.env, {
  UPSTASH_REDIS_REST_URL: "http://fake-upstash.invalid",
  UPSTASH_REDIS_REST_TOKEN: "test-token",
  CLOUDINARY_CLOUD_NAME: "test-cloud",
  CLOUDINARY_API_KEY: "test-key",
  CLOUDINARY_API_SECRET: "test-secret",
  SMTP_HOST: "smtp.invalid",
  SMTP_PORT: "465",
  SMTP_USER: "test",
  SMTP_PASS: "test",
  RAZORPAY_KEY_ID: "rzp_test_unit",
  RAZORPAY_KEY_SECRET: "unit-secret",
  RAZORPAY_WEBHOOK_SECRET: "unit-webhook-secret",
  JWT_ACCESS_SECRET: "unit-access-secret",
  JWT_REFRESH_SECRET: "unit-refresh-secret",
});
