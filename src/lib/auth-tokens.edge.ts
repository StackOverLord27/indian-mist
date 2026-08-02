/**
 * auth-tokens.edge.ts
 *
 * Edge-runtime–safe JWT verification using the Web Crypto SubtleCrypto API.
 * This module must NOT import 'jsonwebtoken', 'crypto' (Node), or any other
 * Node-only package.  It is used exclusively by proxy.ts (edge runtime).
 *
 * The Node-runtime auth-tokens.ts module handles signing and all other
 * Node-side operations (API routes, server components).
 */

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// ─── Base64URL helpers (no Node Buffer) ───────────────────────────────────

function base64urlToUint8Array(base64url: string): Uint8Array {
  // Convert base64url → standard base64 → binary
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// ─── HS256 verification via SubtleCrypto ─────────────────────────────────

/**
 * Verify an HS256 JWT using the Web Crypto API.
 * Returns the decoded payload, or null if the token is invalid or expired.
 * Does NOT throw — the proxy catches null and redirects/rejects.
 */
export async function verifyAccessTokenEdge(
  token: string,
  secret: string
): Promise<AccessTokenPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, sigB64] = parts;

    // Import the secret as a CryptoKey for HMAC-SHA256
    const keyMaterial = new TextEncoder().encode(secret);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyMaterial,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Verify signature
    const signingInput = `${headerB64}.${payloadB64}`;
    // .buffer on TextEncoder/Uint8Array is ArrayBufferLike in TS 6 — .slice()
    // guarantees a plain ArrayBuffer, satisfying SubtleCrypto's BufferSource.
    const sigBytes = base64urlToUint8Array(sigB64);
    const signature = sigBytes.buffer.slice(
      sigBytes.byteOffset,
      sigBytes.byteOffset + sigBytes.byteLength
    ) as ArrayBuffer;
    const dataBytes = new TextEncoder().encode(signingInput);
    const data = dataBytes.buffer.slice(
      dataBytes.byteOffset,
      dataBytes.byteOffset + dataBytes.byteLength
    ) as ArrayBuffer;

    const valid = await crypto.subtle.verify("HMAC", cryptoKey, signature, data);
    if (!valid) return null;

    // Decode payload
    const payloadJson = atob(
      payloadB64.replace(/-/g, "+").replace(/_/g, "/")
    );
    const payload = JSON.parse(payloadJson) as AccessTokenPayload;

    // Check expiry
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}
