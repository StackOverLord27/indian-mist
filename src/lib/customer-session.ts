/**
 * The customer side of sign-in: one place that decides "signed in or not" for every customer
 * call (profile, checkout, orders, saving details, payment verification).
 *
 *  - The access cookie lives 15 minutes. When a call answers 401, the session is renewed ONCE for
 *    all callers at the same moment (single flight, also across tabs where the browser supports
 *    Web Locks) and the call is retried.
 *  - Only a 401 that REMAINS after a successful renewal (or a renewal that itself answers 401)
 *    means "signed out". 429, 5xx, timeouts and network errors never sign anyone out: the caller
 *    gets a failure it can show with a Retry button, and the cookies are not touched.
 *  - Every call has a deadline, so a slow server ends in an error state, not an endless spinner.
 *
 * Browser code only (axios + window). The admin area has its own wrapper (admin-axios.ts).
 */
import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig, type CreateAxiosDefaults, type InternalAxiosRequestConfig } from "axios";

export type RenewResult = "renewed" | "signed-out" | "unavailable";

/** A whole customer call, including a renewal and the retry, must end within this. */
export const REQUEST_DEADLINE_MS = 20_000;
/** The renewal request itself. */
export const RENEW_TIMEOUT_MS = 10_000;
/** Pause before the one extra retry when a call still answers 401 right after a successful renewal. */
export const RETRY_DELAY_MS = 400;

const LAST_RENEWED_KEY = "im_session_renewed_at";

type Tracked = InternalAxiosRequestConfig & { __sentAt?: number; __renewedOnce?: boolean; __delayedRetry?: boolean };
type MarkedError = AxiosError & { sessionState?: "signed-out" | "unavailable" };

function lastRenewedAt(): number {
  try {
    return Number(window.localStorage.getItem(LAST_RENEWED_KEY)) || 0;
  } catch {
    return 0;
  }
}
function rememberRenewal(at: number) {
  try {
    window.localStorage.setItem(LAST_RENEWED_KEY, String(at));
  } catch {
    /* storage blocked: only the cross-tab shortcut is lost */
  }
}

/** Runs `task` while holding a lock shared by all tabs of the site (when the browser has Web Locks). */
function withCrossTabLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  return locks ? locks.request("im-session-renew", task) : task();
}

function deadline(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export function createCustomerSession(defaults: CreateAxiosDefaults = {}) {
  const api: AxiosInstance = axios.create({ baseURL: "", ...defaults });
  const renewClient: AxiosInstance = axios.create({ baseURL: "", ...defaults });
  let inFlight: Promise<RenewResult> | null = null;

  /**
   * Renews the session. Callers that arrive while a renewal is running share it. `sentAt` is when
   * the failing request was sent: if a renewal (here or in another tab) finished after that, the
   * cookies are already fresh and the request only needs repeating.
   */
  function renew(sentAt: number = Date.now()): Promise<RenewResult> {
    if (!inFlight) {
      inFlight = withCrossTabLock(async (): Promise<RenewResult> => {
        if (lastRenewedAt() > sentAt) return "renewed";
        try {
          await renewClient.post("/api/auth/refresh", undefined, { signal: deadline(RENEW_TIMEOUT_MS) });
          rememberRenewal(Date.now());
          return "renewed";
        } catch (error) {
          // 401 is the server saying "this session is over". Anything else (429, 5xx, offline,
          // timeout) says nothing about the session.
          return axios.isAxiosError(error) && error.response?.status === 401 ? "signed-out" : "unavailable";
        }
      }).finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  }

  api.interceptors.request.use((config) => {
    const c = config as Tracked;
    c.__sentAt = Date.now();
    if (!c.signal) c.signal = deadline(REQUEST_DEADLINE_MS); // kept for the retry: one deadline for the whole call
    return c;
  });

  api.interceptors.response.use(undefined, async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401 || !error.config) throw error;
    const config = error.config as Tracked;
    const marked = error as MarkedError;

    if (config.__renewedOnce) {
      // Renewed successfully before and the call is STILL refused: wait a moment (a cookie that
      // is still being stored) and try one more time, then it really is signed out.
      if (config.__delayedRetry) {
        marked.sessionState = "signed-out";
        throw marked;
      }
      config.__delayedRetry = true;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return api.request(config);
    }

    const result = await renew(config.__sentAt);
    if (result !== "renewed") {
      marked.sessionState = result;
      throw marked;
    }
    config.__renewedOnce = true;
    return api.request(config);
  });

  return { api, renew };
}

/** The instance every customer component uses. */
export const customerSession = createCustomerSession();
export const customerApi = customerSession.api;
export const renewSession = customerSession.renew;

// ─── Failures ─────────────────────────────────────────────────────────────

export type FailureKind = "signed-out" | "rate-limited" | "server" | "network" | "timeout" | "other";

export interface Failure {
  kind: FailureKind;
  status?: number;
  retryAfterSeconds?: number;
  /** A message from the server when it sent one (never shown for 5xx) */
  serverMessage?: string;
}

/** Sorts any error from a customer call into something a screen can react to. */
export function classifyFailure(error: unknown): Failure {
  if (!axios.isAxiosError(error)) {
    return { kind: error instanceof Error && error.name === "CanceledError" ? "timeout" : "other" };
  }
  const marked = error as MarkedError;
  if (marked.sessionState === "signed-out") return { kind: "signed-out", status: 401 };
  if (marked.sessionState === "unavailable") return { kind: "server" };
  if (axios.isCancel(error)) return { kind: "timeout" };
  const status = error.response?.status;
  if (status === undefined) return { kind: error.code === "ECONNABORTED" || error.code === "ETIMEDOUT" ? "timeout" : "network" };
  if (status === 401) return { kind: "signed-out", status };
  if (status === 429) {
    const retry = Number(error.response?.headers?.["retry-after"]);
    return { kind: "rate-limited", status, ...(Number.isFinite(retry) && retry > 0 && { retryAfterSeconds: retry }) };
  }
  const data = error.response?.data as { message?: unknown; error?: unknown } | undefined;
  const text = typeof data?.message === "string" ? data.message : typeof data?.error === "string" ? data.error : undefined;
  if (status >= 500) return { kind: "server", status };
  return { kind: "other", status, ...(text && { serverMessage: text }) };
}

/** What to tell the shopper. */
export function failureMessage(failure: Failure): string {
  switch (failure.kind) {
    case "signed-out":
      return "Your session has ended. Please sign in again.";
    case "rate-limited":
      return failure.retryAfterSeconds
        ? `Too many requests right now. Please wait ${failure.retryAfterSeconds} seconds and try again.`
        : "Too many requests right now. Please wait a moment and try again.";
    case "network":
      return "We couldn't reach the shop. Check your connection and try again.";
    case "timeout":
      return "This is taking too long. Please try again.";
    case "server":
      return "The shop is having a problem on its side. Your account is fine; please try again in a moment.";
    default:
      return failure.serverMessage ?? "Something went wrong. Please try again.";
  }
}

export type { AxiosRequestConfig };
