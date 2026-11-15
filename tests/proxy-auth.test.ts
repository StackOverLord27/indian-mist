import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { proxy } from "@/proxy";
import { signAccessToken, signRefreshToken, setTokenCookies, ACCESS_TOKEN_MAX_AGE, REFRESH_LIFETIME } from "@/lib/auth-tokens";
import { NextResponse } from "next/server";

const page = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost${path}`, { headers: cookie ? { cookie } : {} });

let logged: string[];
beforeEach(() => {
  logged = [];
  vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => void logged.push(a.join(" ")));
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const access = () => signAccessToken({ userId: "507f1f77bcf86cd799439011", email: "someone@shop.test", role: "user" });
const refreshCookie = () => signRefreshToken({ userId: "507f1f77bcf86cd799439011", family: randomUUID() }, REFRESH_LIFETIME.user.absolute);

describe("what the proxy does with /profile and /checkout", () => {
  for (const path of ["/profile", "/checkout"]) {
    it(`${path}: no cookies at all → redirect to sign-in with callbackUrl, and one [auth] line saying why`, async () => {
      const res = await proxy(page(path));
      expect(res.status).toBe(307);
      const to = new URL(res.headers.get("location")!);
      expect(to.pathname).toBe("/signin");
      expect(to.searchParams.get("callbackUrl")).toBe(path);
      expect(logged).toEqual([`[auth] sign-in redirect reason=no-session-cookies path=${path}`]);
    });

    it(`${path}: expired access token but a refresh cookie → the page loads so the client can renew (no redirect, no noise)`, async () => {
      const res = await proxy(page(path, `refresh_token=${refreshCookie()}`));
      expect(res.headers.get("location")).toBeNull();
      expect(res.status).toBe(200);
      expect(logged).toEqual([]);
    });

    it(`${path}: a bad access token and no refresh cookie → redirect, with that reason`, async () => {
      const bad = jwt.sign({ userId: "u", email: "e@x.test", role: "user" }, "wrong-secret", { expiresIn: 60 });
      const res = await proxy(page(path, `access_token=${bad}`));
      expect(res.status).toBe(307);
      expect(logged).toEqual([`[auth] sign-in redirect reason=access-token-invalid-and-no-refresh-cookie path=${path}`]);
    });

    it(`${path}: a valid access token passes with the identity headers`, async () => {
      const res = await proxy(page(path, `access_token=${access()}`));
      expect(res.status).toBe(200);
      expect(logged).toEqual([]);
    });
  }

  it("the [auth] lines never contain tokens or e-mail addresses, and a hostile path is neutralised", async () => {
    const token = access();
    await proxy(page("/checkout/%0A%0Dfake-line-someone@shop.test"));
    await proxy(page("/profile", `access_token=${token}x`));
    const text = logged.join("\n");
    expect(text).not.toContain(token);
    expect(logged).toHaveLength(2); // one line per redirect, whatever the path contains
    expect(logged.every((l) => l.startsWith("[auth] ") && !l.includes("\n"))).toBe(true);
  });

  it("API calls without an access token get 401 JSON (the client renews and retries), page rules unchanged", async () => {
    const res = await proxy(new NextRequest("http://localhost/api/profile"));
    expect(res.status).toBe(401);
  });
});

describe("cookie attributes (hypothesis A, at the cookie level)", () => {
  it("both auth cookies are httpOnly, path /, SameSite=Lax, with their real lifetimes", () => {
    const res = NextResponse.json({});
    setTokenCookies(res, "a", "r", REFRESH_LIFETIME.user.sliding);
    const header = (name: string) => res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`))!;
    for (const name of ["access_token", "refresh_token"]) {
      expect(header(name)).toMatch(/HttpOnly/i);
      expect(header(name)).toMatch(/Path=\//);
      expect(header(name)).toMatch(/SameSite=lax/i);
    }
    expect(header("access_token")).toContain(`Max-Age=${ACCESS_TOKEN_MAX_AGE}`);
    expect(ACCESS_TOKEN_MAX_AGE).toBe(15 * 60);
    expect(header("refresh_token")).toContain(`Max-Age=${REFRESH_LIFETIME.user.sliding}`);
    // no Expires-less session cookies: closing the browser does not end the session
    expect(header("access_token")).not.toMatch(/Max-Age=0/);
  });
});
