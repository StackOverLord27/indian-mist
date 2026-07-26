"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Leaf, UserPlus, AlertCircle, CheckCircle2 } from "lucide-react";

type Step = "register" | "verify";

interface FormState {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function SignUpPage() {
  const [step, setStep] = useState<Step>("register");
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  // ── Password strength ─────────────────────────────────────────────────────
  const passwordStrength = (() => {
    const p = form.password;
    if (!p) return 0;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score; // 0–4
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][passwordStrength];
  const strengthColor = [
    "",
    "bg-red-400",
    "bg-sunlit-clay",
    "bg-olive-leaf/70",
    "bg-olive-leaf",
  ][passwordStrength];

  // ── Step 1 – Register ────────────────────────────────────────────────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.name.trim()) return setError("Full name is required.");
    if (!form.email.trim()) return setError("Email address is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return setError("Please enter a valid email address.");
    if (!form.password) return setError("Password is required.");
    if (form.password.length < 8)
      return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirmPassword)
      return setError("Passwords do not match. Please try again.");

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
      } else {
        setSuccess("Account created! Check your email for the 6-digit OTP.");
        setStep("verify");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 2 – Verify OTP ─────────────────────────────────────────────────
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!otp.trim() || otp.trim().length !== 6)
      return setError("Please enter the 6-digit OTP sent to your email.");

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, otp: otp.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "OTP verification failed. Please try again.");
      } else {
        setSuccess("Email verified! Your account is ready.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Resend OTP ───────────────────────────────────────────────────────────
  async function handleResend() {
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to resend OTP.");
      } else {
        setSuccess("A new OTP has been sent to your email.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-cornsilk px-4 py-16">
      <div className="w-full max-w-md">
        <div className="rounded-md border border-olive-leaf/15 bg-warm-mist shadow-sm overflow-hidden">
          {/* Top stripe */}
          <div className="h-1 w-full bg-gradient-to-r from-olive-leaf via-sunlit-clay to-copperwood" />

          <div className="px-8 py-10">
            {/* Brand mark */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-11 h-11 rounded-full bg-cornsilk border border-olive-leaf/20 flex items-center justify-center mb-4">
                <Leaf size={20} className="text-olive-leaf" />
              </div>
              {step === "register" ? (
                <>
                  <h1 className="font-merriweather text-2xl font-normal text-black-forest text-center">
                    Create an account
                  </h1>
                  <p className="font-montserrat text-xs font-light text-muted-text mt-2 text-center tracking-wide">
                    Join the Indian Mist community
                  </p>
                </>
              ) : (
                <>
                  <h1 className="font-merriweather text-2xl font-normal text-black-forest text-center">
                    Verify your email
                  </h1>
                  <p className="font-montserrat text-xs font-light text-muted-text mt-2 text-center tracking-wide max-w-xs">
                    Enter the 6-digit code sent to{" "}
                    <span className="font-medium text-olive-leaf">{form.email}</span>
                  </p>
                </>
              )}
            </div>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {(["register", "verify"] as Step[]).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-montserrat text-xs font-semibold transition-colors ${
                      step === s
                        ? "bg-olive-leaf text-cornsilk"
                        : s === "verify" && step === "register"
                        ? "bg-olive-leaf/15 text-muted-text"
                        : "bg-olive-leaf/15 text-muted-text"
                    }`}
                  >
                    {step === "verify" && s === "register" ? "✓" : i + 1}
                  </div>
                  <span
                    className={`font-montserrat text-xs uppercase tracking-widest ${
                      step === s ? "text-black-forest font-medium" : "text-muted-text"
                    }`}
                  >
                    {s === "register" ? "Details" : "Verify"}
                  </span>
                  {i === 0 && (
                    <div className="w-8 h-px bg-olive-leaf/20 mx-1" />
                  )}
                </div>
              ))}
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

            {/* ── Registration form ── */}
            {step === "register" && (
              <form onSubmit={handleRegister} noValidate className="space-y-5">
                {/* Name */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="signup-name"
                    className="block font-montserrat text-xs font-medium uppercase tracking-widest text-black-forest/70"
                  >
                    Full name
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    name="name"
                    autoComplete="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Arjun Sharma"
                    disabled={isLoading}
                    className="w-full rounded-sm border border-olive-leaf/25 bg-cornsilk px-4 py-3 font-montserrat text-sm text-black-forest placeholder:text-olive-leaf/40 outline-none transition focus:border-olive-leaf focus:ring-1 focus:ring-olive-leaf/30 disabled:opacity-60"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="signup-email"
                    className="block font-montserrat text-xs font-medium uppercase tracking-widest text-black-forest/70"
                  >
                    Email address
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    disabled={isLoading}
                    className="w-full rounded-sm border border-olive-leaf/25 bg-cornsilk px-4 py-3 font-montserrat text-sm text-black-forest placeholder:text-olive-leaf/40 outline-none transition focus:border-olive-leaf focus:ring-1 focus:ring-olive-leaf/30 disabled:opacity-60"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="signup-password"
                    className="block font-montserrat text-xs font-medium uppercase tracking-widest text-black-forest/70"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      name="password"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="Min. 8 characters"
                      disabled={isLoading}
                      className="w-full rounded-sm border border-olive-leaf/25 bg-cornsilk px-4 py-3 pr-11 font-montserrat text-sm text-black-forest placeholder:text-olive-leaf/40 outline-none transition focus:border-olive-leaf focus:ring-1 focus:ring-olive-leaf/30 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-olive-leaf/60 hover:text-olive-leaf transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {/* Strength bar */}
                  {form.password && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i <= passwordStrength ? strengthColor : "bg-olive-leaf/10"
                            }`}
                          />
                        ))}
                      </div>
                      {strengthLabel && (
                        <p className="font-montserrat text-xs text-muted-text">
                          Strength:{" "}
                          <span
                            className={`font-medium ${
                              passwordStrength === 1
                                ? "text-red-500"
                                : passwordStrength === 2
                                ? "text-sunlit-clay"
                                : "text-olive-leaf"
                            }`}
                          >
                            {strengthLabel}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="signup-confirm-password"
                    className="block font-montserrat text-xs font-medium uppercase tracking-widest text-black-forest/70"
                  >
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      id="signup-confirm-password"
                      type={showConfirm ? "text" : "password"}
                      name="confirmPassword"
                      autoComplete="new-password"
                      value={form.confirmPassword}
                      onChange={handleChange}
                      placeholder="Repeat your password"
                      disabled={isLoading}
                      className={`w-full rounded-sm border bg-cornsilk px-4 py-3 pr-11 font-montserrat text-sm text-black-forest placeholder:text-olive-leaf/40 outline-none transition focus:ring-1 disabled:opacity-60 ${
                        form.confirmPassword && form.password !== form.confirmPassword
                          ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                          : "border-olive-leaf/25 focus:border-olive-leaf focus:ring-olive-leaf/30"
                      }`}
                    />
                    <button
                      type="button"
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-olive-leaf/60 hover:text-olive-leaf transition-colors"
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {form.confirmPassword && form.password !== form.confirmPassword && (
                    <p className="font-montserrat text-xs text-red-500">
                      Passwords do not match.
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button
                  id="signup-submit"
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-sm bg-olive-leaf px-6 py-3.5 font-montserrat text-xs font-semibold uppercase tracking-wider text-cornsilk transition-colors hover:bg-black-forest disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <span className="size-4 rounded-full border-2 border-cornsilk/30 border-t-cornsilk animate-spin" />
                      Creating account…
                    </>
                  ) : (
                    <>
                      <UserPlus size={15} />
                      Create account
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ── OTP verification form ── */}
            {step === "verify" && (
              <form onSubmit={handleVerify} noValidate className="space-y-5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="signup-otp"
                    className="block font-montserrat text-xs font-medium uppercase tracking-widest text-black-forest/70"
                  >
                    One-time password (OTP)
                  </label>
                  <input
                    id="signup-otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => {
                      setError(null);
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                    }}
                    placeholder="123456"
                    disabled={isLoading || !!success}
                    className="w-full rounded-sm border border-olive-leaf/25 bg-cornsilk px-4 py-3 text-center font-montserrat text-xl font-medium tracking-[0.6em] text-black-forest placeholder:text-olive-leaf/30 placeholder:tracking-widest outline-none transition focus:border-olive-leaf focus:ring-1 focus:ring-olive-leaf/30 disabled:opacity-60"
                  />
                  <p className="font-montserrat text-xs text-muted-text">
                    Enter the 6-digit code from your email inbox.
                  </p>
                </div>

                {/* Submit */}
                {!success && (
                  <button
                    id="otp-submit"
                    type="submit"
                    disabled={isLoading || otp.length !== 6}
                    className="flex w-full items-center justify-center gap-2 rounded-sm bg-olive-leaf px-6 py-3.5 font-montserrat text-xs font-semibold uppercase tracking-wider text-cornsilk transition-colors hover:bg-black-forest disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading ? (
                      <>
                        <span className="size-4 rounded-full border-2 border-cornsilk/30 border-t-cornsilk animate-spin" />
                        Verifying…
                      </>
                    ) : (
                      "Verify email"
                    )}
                  </button>
                )}

                {success && (
                  <Link
                    href="/signin"
                    className="flex w-full items-center justify-center gap-2 rounded-sm bg-olive-leaf px-6 py-3.5 font-montserrat text-xs font-semibold uppercase tracking-wider text-cornsilk transition-colors hover:bg-black-forest"
                  >
                    Sign in now
                  </Link>
                )}

                {/* Resend */}
                {!success && (
                  <p className="text-center font-montserrat text-xs text-muted-text">
                    Didn&apos;t receive a code?{" "}
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={isLoading}
                      className="font-medium text-olive-leaf hover:text-copperwood transition-colors disabled:opacity-60"
                    >
                      Resend OTP
                    </button>
                  </p>
                )}
              </form>
            )}

            {/* Sign in link */}
            {step === "register" && (
              <>
                <div className="my-7 flex items-center gap-3">
                  <div className="flex-1 h-px bg-olive-leaf/15" />
                  <span className="font-montserrat text-xs text-muted-text">or</span>
                  <div className="flex-1 h-px bg-olive-leaf/15" />
                </div>
                <p className="text-center font-montserrat text-xs text-muted-text">
                  Already have an account?{" "}
                  <Link
                    href="/signin"
                    className="font-medium text-olive-leaf hover:text-copperwood transition-colors"
                  >
                    Sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
