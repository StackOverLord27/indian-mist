import { afterEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { limiterKindForPath } from "@/lib/rate-limit-paths";
import { PasswordSchema } from "@/schemas/auth/password.schema";
import { SignUpSchema } from "@/schemas/auth/signup.schema";
import { ResetPasswordSchema } from "@/schemas/auth/forgot-password.schema";
import { SignInSchema } from "@/schemas/auth/signin.schema";
import { roleForEmail, isSuperAdminEmail, normalizeEmail } from "@/lib/roles";
import { EnvError, getRazorpayKeyId, getSmtpConfig, getMongoUri, getRedisConfig } from "@/lib/env";
import { signAccessToken, verifyAccessToken, verifyRefreshToken } from "@/lib/auth-tokens";
import { verifyAccessTokenEdge } from "@/lib/auth-tokens.edge";

afterEach(() => vi.unstubAllEnvs());

describe("rate limit path matching", () => {
  it("applies the strict limiter to every credential and OTP endpoint, including forgot-password/*", () => {
    for (const path of [
      "/api/auth/signin",
      "/api/auth/signup",
      "/api/auth/verify-otp",
      "/api/auth/forgot-password",
      "/api/auth/forgot-password/request-otp",
      "/api/auth/forgot-password/reset",
      "/api/auth/forgot-password/reset/",
    ]) {
      expect(limiterKindForPath(path), path).toBe("auth");
    }
  });

  it("uses the form limiter for contact and subscribe", () => {
    expect(limiterKindForPath("/api/contact")).toBe("form");
    expect(limiterKindForPath("/api/subscribe")).toBe("form");
  });

  it("matches on a path boundary and leaves the rest on the general limiter", () => {
    for (const path of [
      "/api/auth/refresh",
      "/api/auth/signout",
      "/api/auth/signin-other",
      "/api/auth/forgot-passwordX",
      "/api/contacts",
      "/api/products",
      "/api/checkout/create-order",
    ]) {
      expect(limiterKindForPath(path), path).toBe("general");
    }
  });
});

describe("one password schema for sign-up and reset", () => {
  const weak = ["alllowercase1!", "NoNumbers!!", "NoSpecial123A", "Sh0rt!", "a".repeat(8)];
  const strong = ["Passw0rd!", "Correct-Horse-9", "Ünïcödé-Pass1!"];

  it.each(weak)("rejects %s in both places", (password) => {
    expect(PasswordSchema.safeParse(password).success).toBe(false);
    expect(SignUpSchema.safeParse({ name: "Asha", email: "a@b.co", password }).success).toBe(false);
    expect(
      ResetPasswordSchema.safeParse({ email: "a@b.co", otp: "123456", newPassword: password, confirmPassword: password }).success,
    ).toBe(false);
  });

  it.each(strong)("accepts %s in both places", (password) => {
    expect(PasswordSchema.safeParse(password).success).toBe(true);
    expect(SignUpSchema.safeParse({ name: "Asha", email: "a@b.co", password }).success).toBe(true);
    expect(
      ResetPasswordSchema.safeParse({ email: "a@b.co", otp: "123456", newPassword: password, confirmPassword: password }).success,
    ).toBe(true);
  });

  it("caps the length at 72 bytes (what bcrypt actually uses)", () => {
    expect(PasswordSchema.safeParse("Aa1!" + "x".repeat(68)).success).toBe(true); // 72 bytes
    expect(PasswordSchema.safeParse("Aa1!" + "x".repeat(69)).success).toBe(false); // 73
    expect(PasswordSchema.safeParse("Aa1!" + "é".repeat(35)).success).toBe(false); // 39 chars, 74 bytes
  });

  it("reset requires matching confirmation and a numeric 6 digit code", () => {
    const base = { email: "a@b.co", otp: "123456", newPassword: "Passw0rd!", confirmPassword: "Passw0rd!" };
    expect(ResetPasswordSchema.safeParse(base).success).toBe(true);
    expect(ResetPasswordSchema.safeParse({ ...base, confirmPassword: "Different1!" }).success).toBe(false);
    expect(ResetPasswordSchema.safeParse({ ...base, otp: "12345a" }).success).toBe(false);
  });

  it("sign-in stays lenient for existing users", () => {
    expect(SignInSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
});

describe("role helper", () => {
  it("is admin only for the super-admin email, ignoring case and surrounding whitespace on both sides", () => {
    expect(roleForEmail("admin@shop.com", "admin@shop.com")).toBe("admin");
    expect(roleForEmail("ADMIN@Shop.com", "admin@shop.com")).toBe("admin");
    expect(roleForEmail("  admin@shop.com  ", "admin@shop.com")).toBe("admin");
    expect(roleForEmail("admin@shop.com", "  Admin@SHOP.com ")).toBe("admin");
    expect(roleForEmail("other@shop.com", "admin@shop.com")).toBe("user");
    expect(roleForEmail("admin@shop.com.evil.com", "admin@shop.com")).toBe("user");
  });

  it("nobody is admin when the super-admin email is unset or blank", () => {
    expect(roleForEmail("admin@shop.com", "")).toBe("user");
    expect(roleForEmail("", "")).toBe("user");
    expect(isSuperAdminEmail("a@b.co", "   ")).toBe(false);
  });

  it("reads SUPER_ADMIN_EMAIL from the environment", () => {
    vi.stubEnv("SUPER_ADMIN_EMAIL", " Boss@Shop.com ");
    expect(roleForEmail("boss@shop.COM")).toBe("admin");
    vi.stubEnv("SUPER_ADMIN_EMAIL", "");
    expect(roleForEmail("boss@shop.com")).toBe("user");
    expect(normalizeEmail(" A@B.Co ")).toBe("a@b.co");
  });

  it("only ever returns the two token role names", () => {
    expect(["admin", "user"]).toContain(roleForEmail("x@y.zz", "x@y.zz"));
  });
});

describe("environment module", () => {
  it("names the missing variable and never prints a value", () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    let message = "";
    try {
      getRazorpayKeyId();
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      message = (error as Error).message;
    }
    expect(message).toContain("RAZORPAY_KEY_ID");
  });

  it("does not leak the value of a set variable in errors about it", () => {
    vi.stubEnv("SMTP_PORT", "secret-looking-value");
    expect(() => getSmtpConfig()).toThrow(/SMTP_PORT/);
    try {
      getSmtpConfig();
    } catch (error) {
      expect((error as Error).message).not.toContain("secret-looking-value");
    }
  });

  it("has no silent fallbacks for required settings, and treats blank as missing", () => {
    vi.stubEnv("MONGODB_URI", "   ");
    expect(() => getMongoUri()).toThrow(/MONGODB_URI/);
    vi.stubEnv("SMTP_FROM", "");
    expect(() => getSmtpConfig()).toThrow(/SMTP_FROM/);
  });

  it("SMTP_PORT is optional and defaults to 587", () => {
    vi.stubEnv("SMTP_PORT", "");
    expect(getSmtpConfig().port).toBe(587);
  });

  it("Redis config is null when missing or still a placeholder", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "your_upstash_url");
    expect(getRedisConfig()).toBeNull();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    expect(getRedisConfig()).toBeNull();
  });
});

describe("JWT algorithm is pinned to HS256", () => {
  const secret = process.env.JWT_ACCESS_SECRET!;
  const payload = { userId: "u1", email: "a@b.co", role: "admin" };

  it("accepts tokens we signed", () => {
    expect(verifyAccessToken(signAccessToken(payload)).role).toBe("admin");
  });

  it("rejects HS512, unsigned and tampered tokens (node verifier)", () => {
    const hs512 = jwt.sign(payload, secret, { algorithm: "HS512", expiresIn: "5m" });
    expect(() => verifyAccessToken(hs512)).toThrow();
    const none = jwt.sign(payload, "", { algorithm: "none" } as jwt.SignOptions);
    expect(() => verifyAccessToken(none)).toThrow();
    const good = signAccessToken(payload);
    expect(() => verifyAccessToken(good.slice(0, -2) + "xx")).toThrow();
    expect(() => verifyRefreshToken(good)).toThrow(); // wrong secret
  });

  it("the proxy verifier also rejects other algorithms", async () => {
    const good = signAccessToken(payload);
    expect((await verifyAccessTokenEdge(good, secret))?.role).toBe("admin");
    const hs512 = jwt.sign(payload, secret, { algorithm: "HS512", expiresIn: "5m" });
    expect(await verifyAccessTokenEdge(hs512, secret)).toBeNull();
    // swap the header to claim "none" while keeping the HS256 signature
    const [, body, sig] = good.split(".");
    const noneHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    expect(await verifyAccessTokenEdge(`${noneHeader}.${body}.${sig}`, secret)).toBeNull();
  });
});
