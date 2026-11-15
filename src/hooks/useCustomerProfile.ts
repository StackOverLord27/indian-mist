"use client";

import { useCallback, useEffect, useState } from "react";
import { customerApi, classifyFailure, type Failure } from "@/lib/customer-session";
import type { UserData, OrderData } from "@/components/profile/types";

export type CustomerProfileState =
  | { status: "loading" }
  | { status: "ready"; user: UserData; orders: OrderData[] }
  | { status: "error"; failure: Failure }
  | { status: "signed-out" };

/**
 * Loads /api/profile (the account, its saved address and the order history) for the profile page
 * and the checkout prefill. The state is always one of: loading, ready, error (with a failure the
 * screen can word, and `retry`), or signed-out (a 401 that survived a renewal).
 */
export function useCustomerProfile(options: { orders?: boolean } = {}) {
  const wantOrders = options.orders !== false; // the checkout only needs the saved details: it passes { orders: false }
  const [state, setState] = useState<CustomerProfileState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    customerApi
      .get<{ user?: UserData; orders?: OrderData[] }>(wantOrders ? "/api/profile" : "/api/profile?orders=0")
      .then(({ data }) => {
        if (cancelled) return;
        if (!data?.user) {
          setState({ status: "error", failure: { kind: "other" } });
          return;
        }
        setState({ status: "ready", user: data.user, orders: data.orders ?? [] });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const failure = classifyFailure(error);
        setState(failure.kind === "signed-out" ? { status: "signed-out" } : { status: "error", failure });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, wantOrders]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  /** Replaces the loaded user after a successful save */
  const setUser = useCallback((user: UserData) => {
    setState((s) => (s.status === "ready" ? { ...s, user } : s));
  }, []);

  return { state, retry, setUser };
}
