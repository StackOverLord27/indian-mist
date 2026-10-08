"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Leaf, LogIn, AlertCircle, CheckCircle2 } from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", password: "" });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.email.trim()) {
      setError("Email address is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!form.password) {
      setError("Password is required.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
      } else {
        setSuccess("Signed in successfully! Redirecting…");
        setTimeout(() => router.push(callbackUrl), 1200);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-cornsilk px-4 py-16">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-md border border-olive-leaf/15 bg-warm-mist shadow-sm overflow-hidden">
          {/* Top stripe */}
          <div className="h-1 w-full bg-gradient-to-r from-olive-leaf via-sunlit-clay to-copperwood" />

          <div className="px-8 py-10">
            {/* Brand mark */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-11 h-11 rounded-full bg-cornsilk border border-olive-leaf/20 flex items-center justify-center mb-4">
                <Leaf size={20} className="text-olive-leaf" />
              </div>
              <h1 className="font-merriweather text-2xl font-normal text-black-forest text-center">
                Welcome back
              </h1>
              <p className="font-montserrat text-xs font-light text-muted-text mt-2 text-center tracking-wide">
                Sign in to your Indian Mist account
              </p>
            </div>

            {/* Messages */}
            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-sm border border-red-300 bg-red-50 px-4 py-3"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
                <p className="font-montserrat text-xs text-red-700">{error}</p>
              </div>
            )}
            {success && (
              <div
                role="status"
                className="mb-5 flex items-start gap-3 rounded-sm border border-olive-leaf/30 bg-olive-leaf/10 px-4 py-3"
              >
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-olive-leaf" />
                <p className="font-montserrat text-xs text-black-forest">{success}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="signin-email"
                  className="block font-montserrat text-xs font-medium uppercase tracking-widest text-black-forest/80"
                >
                  Email address
                </label>
                <input
                  id="signin-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  disabled={isLoading}
                  className="w-full rounded-sm border border-olive-leaf/25 bg-cornsilk px-4 py-3 font-montserrat text-sm text-black-forest placeholder:text-olive-leaf/70 outline-none transition focus:border-olive-leaf focus:ring-1 focus:ring-olive-leaf/30 disabled:opacity-60"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="signin-password"
                    className="block font-montserrat text-xs font-medium uppercase tracking-widest text-black-forest/80"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="font-montserrat text-xs text-olive-leaf hover:text-copperwood transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="signin-password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Your password"
                    disabled={isLoading}
                    className="w-full rounded-sm border border-olive-leaf/25 bg-cornsilk px-4 py-3 pr-11 font-montserrat text-sm text-black-forest placeholder:text-olive-leaf/70 outline-none transition focus:border-olive-leaf focus:ring-1 focus:ring-olive-leaf/30 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-olive-leaf/80 hover:text-olive-leaf transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                id="signin-submit"
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-sm bg-olive-leaf px-6 py-3.5 font-montserrat text-xs font-semibold uppercase tracking-wider text-cornsilk transition-colors hover:bg-black-forest disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <span className="size-4 rounded-full border-2 border-cornsilk/30 border-t-cornsilk animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    <LogIn size={15} />
                    Sign in
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="my-7 flex items-center gap-3">
              <div className="flex-1 h-px bg-olive-leaf/15" />
              <span className="font-montserrat text-xs text-muted-text">or</span>
              <div className="flex-1 h-px bg-olive-leaf/15" />
            </div>

            {/* Sign up link */}
            <p className="text-center font-montserrat text-xs text-muted-text">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-medium text-olive-leaf hover:text-copperwood transition-colors"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
