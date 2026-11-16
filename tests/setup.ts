// Safety rail: Vitest does not load .env, but the shell might export real
// service credentials. Blank them and install harmless dummies so no test can
// reach Atlas, Upstash, Cloudinary, SMTP or Razorpay by accident.
const SCRUB = [
  "MONGODB_URI", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN",
  "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET",
  "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM",
  "MAIL_HOST", "MAIL_PORT", "MAIL_USER", "MAIL_PASS", "EMAIL_ENABLED", "EMAIL_ALLOWLIST", "VERCEL_ENV",
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
  SMTP_FROM: "noreply@test.invalid",
  RAZORPAY_KEY_ID: "rzp_test_unit",
  RAZORPAY_KEY_SECRET: "unit-secret",
  RAZORPAY_WEBHOOK_SECRET: "unit-webhook-secret",
  NEXT_PUBLIC_SITE_URL: "https://shop.example.test",
  JWT_ACCESS_SECRET: "unit-access-secret",
  JWT_REFRESH_SECRET: "unit-refresh-secret",
});

// Tests behave like the live deployment for mail (the non-production allowlist is tested on
// purpose, by stubbing VERCEL_ENV); the guard below is what keeps them away from real servers.
process.env.VERCEL_ENV = "production";

/*
 * Mail safety rail: no test may open a connection to a real mail server. Any attempt to connect
 * to a mail submission port (25, 465, 587, 2525) on a host that is not this machine throws, so
 * the test fails instead of sending mail. Tests use the local fake SMTP server
 * (tests/helpers/smtp-sink.ts) or mock nodemailer.
 */
import net from "node:net";
const MAIL_PORTS = new Set([25, 465, 587, 2525]);
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "0.0.0.0", ""]);
const realConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (this: net.Socket, ...args: unknown[]) {
  // net.connect() hands over its already-normalised arguments as one array: [options, callback]
  const first = (Array.isArray(args[0]) ? args[0][0] : args[0]) as unknown;
  const opts = (typeof first === "object" && first !== null ? first : { port: first, host: typeof args[1] === "string" ? args[1] : undefined }) as { port?: unknown; host?: string; path?: string };
  const port = Number(opts.port);
  if (!opts.path && MAIL_PORTS.has(port) && !LOCAL_HOSTS.has(String(opts.host ?? ""))) {
    throw new Error(`Test safety rail: refusing to connect to a mail server (${opts.host}:${port}). Use tests/helpers/smtp-sink.ts.`);
  }
  return (realConnect as (...a: unknown[]) => net.Socket).apply(this, args);
} as typeof net.Socket.prototype.connect;
