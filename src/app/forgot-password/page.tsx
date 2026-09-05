"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Leaf, AlertCircle, CheckCircle2, ArrowRight, KeyRound } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  
  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Step 1 state
  const [email, setEmail] = useState("");
  
  // Step 2 state
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to request OTP. Please try again.");
      } else {
        setSuccess("Verification code sent to your email!");
        setTimeout(() => {
          setSuccess(null);
          setStep(2);
        }, 1500);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (otp.length !== 6) {
      setError("OTP must be exactly 6 digits.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to reset password.");
      } else {
        // If the user is an admin, set the localStorage item required by the admin dashboard
        if (data.user?.role === "admin") {
          localStorage.setItem("im_admin_user", JSON.stringify(data.user));
          setSuccess(data.message || "Password reset successfully! Redirecting to dashboard...");
          setTimeout(() => router.push("/admin"), 2000);
        } else {
          setSuccess(data.message || "Password reset successfully! Redirecting...");
          setTimeout(() => router.push("/"), 2000);
        }
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

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
                {step === 1 ? "Reset Password" : "Create New Password"}
              </h1>
              <p className="font-montserrat text-xs font-light text-muted-text mt-2 text-center tracking-wide">
                {step === 1 
                  ? "Enter your email to receive a verification code" 
                  : `Enter the 6-digit code sent to ${email}`}
              </p>
            </div>

            {/* Messages */}
            {error && (
              <div role="alert" className="mb-5 flex items-start gap-3 rounded-sm border border-red-300 bg-red-50 px-4 py-3">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
                <p className="font-montserrat text-xs text-red-700">{error}</p>
              </div>
            )}
            {success && (
              <div role="status" className="mb-5 flex items-start gap-3 rounded-sm border border-olive-leaf/30 bg-olive-leaf/10 px-4 py-3">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-olive-leaf" />
                <p className="font-montserrat text-xs text-black-forest">{success}</p>
              </div>
            )}

            {step === 1 ? (
              /* Step 1 Form */
              <form onSubmit={handleRequestOtp} noValidate className="space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor="reset-email" className="block font-montserrat text-xs font-medium uppercase tracking-widest text-black-forest/70">
                    Email address
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setError(null);
                      setEmail(e.target.value);
                    }}
                    placeholder="you@example.com"
                    disabled={isLoading || !!success}
                    className="w-full rounded-sm border border-olive-leaf/25 bg-cornsilk px-4 py-3 font-montserrat text-sm text-black-forest placeholder:text-olive-leaf/40 outline-none transition focus:border-olive-leaf focus:ring-1 focus:ring-olive-leaf/30 disabled:opacity-60"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !!success}
                  className="flex w-full items-center justify-center gap-2 rounded-sm bg-olive-leaf px-6 py-3.5 font-montserrat text-xs font-semibold uppercase tracking-wider text-cornsilk transition-colors hover:bg-black-forest disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="size-4 rounded-full border-2 border-cornsilk/30 border-t-cornsilk animate-spin" />
                  ) : (
                    <>
                      Send Code <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Step 2 Form */
              <form onSubmit={handleResetPassword} noValidate className="space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor="reset-otp" className="block font-montserrat text-xs font-medium uppercase tracking-widest text-black-forest/70">
                    Verification Code
                  </label>
                  <input
                    id="reset-otp"
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => {
                      setError(null);
                      setOtp(e.target.value.replace(/\D/g, ''));
                    }}
                    placeholder="123456"
                    disabled={isLoading || !!success}
                    className="w-full rounded-sm border border-olive-leaf/25 bg-cornsilk px-4 py-3 font-montserrat text-sm text-black-forest placeholder:text-olive-leaf/40 outline-none transition focus:border-olive-leaf focus:ring-1 focus:ring-olive-leaf/30 disabled:opacity-60 tracking-[0.3em] text-center"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="reset-new-password" className="block font-montserrat text-xs font-medium uppercase tracking-widest text-black-forest/70">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="reset-new-password"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => {
                        setError(null);
                        setNewPassword(e.target.value);
                      }}
                      placeholder="At least 8 characters"
                      disabled={isLoading || !!success}
                      className="w-full rounded-sm border border-olive-leaf/25 bg-cornsilk px-4 py-3 pr-11 font-montserrat text-sm text-black-forest placeholder:text-olive-leaf/40 outline-none transition focus:border-olive-leaf focus:ring-1 focus:ring-olive-leaf/30 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-olive-leaf/60 hover:text-olive-leaf transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="reset-confirm-password" className="block font-montserrat text-xs font-medium uppercase tracking-widest text-black-forest/70">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="reset-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => {
                        setError(null);
                        setConfirmPassword(e.target.value);
                      }}
                      placeholder="Repeat new password"
                      disabled={isLoading || !!success}
                      className="w-full rounded-sm border border-olive-leaf/25 bg-cornsilk px-4 py-3 pr-11 font-montserrat text-sm text-black-forest placeholder:text-olive-leaf/40 outline-none transition focus:border-olive-leaf focus:ring-1 focus:ring-olive-leaf/30 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-olive-leaf/60 hover:text-olive-leaf transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !!success}
                  className="flex w-full items-center justify-center gap-2 rounded-sm bg-olive-leaf px-6 py-3.5 font-montserrat text-xs font-semibold uppercase tracking-wider text-cornsilk transition-colors hover:bg-black-forest disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="size-4 rounded-full border-2 border-cornsilk/30 border-t-cornsilk animate-spin" />
                  ) : (
                    <>
                      <KeyRound size={15} /> Save & Sign In
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={isLoading || !!success}
                  className="w-full mt-2 font-montserrat text-xs font-medium text-muted-text hover:text-black-forest transition-colors"
                >
                  Back to email
                </button>
              </form>
            )}

            {/* Divider */}
            <div className="my-7 flex items-center gap-3">
              <div className="flex-1 h-px bg-olive-leaf/15" />
              <span className="font-montserrat text-xs text-muted-text">or</span>
              <div className="flex-1 h-px bg-olive-leaf/15" />
            </div>

            {/* Back to sign in link */}
            <p className="text-center font-montserrat text-xs text-muted-text">
              Remember your password?{" "}
              <Link href="/signin" className="font-medium text-olive-leaf hover:text-copperwood transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
