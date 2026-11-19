// Loads the local .env (read-only) for live tests and enforces safety rails.
process.loadEnvFile(".env");
for (const k of ["RAZORPAY_KEY_ID", "NEXT_PUBLIC_RAZORPAY_KEY_ID"]) {
  const v = process.env[k];
  if (v && !v.startsWith("rzp_test_")) throw new Error(`${k} is not an rzp_test_ key; refusing to run live tests.`);
}
// Live tests must never write to the production database.
delete process.env.MONGODB_URI;
