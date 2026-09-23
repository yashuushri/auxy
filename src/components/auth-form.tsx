"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Loader2, RefreshCw, KeyRound, CheckCircle2, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { isUsernameTaken, isEmailTaken, getUserByEmailOrUsername, isValidUsername, saveUser } from "@/lib/storage";
import { validatePasswordStrength } from "@/lib/otp-store";
import { fetchUserProfileFromSupabase } from "@/lib/supabase-db";

interface AuthFormProps {
  mode?: "login" | "register" | "forgot";
  onBack?: () => void;
  onSwitchMode?: (mode: "login" | "register" | "forgot") => void;
  compact?: boolean;
}

export function AuthForm({
  mode: initialMode = "login",
  onBack,
  onSwitchMode,
  compact = false,
}: AuthFormProps) {
  const { loginWithEmail, signUpWithEmail, resetPasswordWithEmail } = useAuth();
  const router = useRouter();
  const [internalMode, setInternalMode] = useState<"login" | "register" | "forgot">(initialMode);
  const activeMode = onSwitchMode ? initialMode : internalMode;

  // Step: "form" | "otp" | "reset-password"
  const [step, setStep] = useState<"form" | "otp" | "reset-password">("form");

  // Form Fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Reset Password Fields (for forgot password)
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // OTP State
  const [otpDigits, setOtpDigits] = useState(["", "", "", ""]);
  const [targetEmail, setTargetEmail] = useState("");
  const [targetUsername, setTargetUsername] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  // Status
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Ref array for 4-digit OTP input boxes
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  function handleBack() {
    if (step === "reset-password") {
      setStep("otp");
      setErrorMsg(null);
      return;
    }

    if (step === "otp") {
      setStep("form");
      setErrorMsg(null);
      setSuccessMsg(null);
      setOtpDigits(["", "", "", ""]);
      return;
    }

    if (activeMode === "forgot") {
      handleSwitch("login");
      return;
    }

    if (onBack) {
      onBack();
    } else {
      router.push("/");
    }
  }

  function handleSwitch(target: "login" | "register" | "forgot") {
    setErrorMsg(null);
    setSuccessMsg(null);
    setStep("form");
    setOtpDigits(["", "", "", ""]);
    if (onSwitchMode) {
      onSwitchMode(target);
    } else {
      setInternalMode(target);
    }
  }

  // Handle Form Submission (Validates and triggers 4-digit OTP to Brevo)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (activeMode === "register") {
      const cleanUser = username.trim();
      const cleanEmail = email.trim().toLowerCase();

      if (!cleanUser) {
        setErrorMsg("Please enter a username.");
        return;
      }

      // Check strictly alphanumeric: NO symbols (-, _, +, ., %, $, etc.) and NO spaces
      if (!isValidUsername(cleanUser)) {
        setErrorMsg("Username can only contain letters and numbers (no spaces, dashes, dots, or symbols allowed).");
        return;
      }

      if (cleanUser.length < 2 || cleanUser.length > 16) {
        setErrorMsg("Username must be between 2 and 16 characters.");
        return;
      }

      // 1. Strict Username Uniqueness Check
      if (isUsernameTaken(cleanUser)) {
        setErrorMsg("This username is already taken. Please choose another username.");
        return;
      }

      if (!cleanEmail || !cleanEmail.includes("@")) {
        setErrorMsg("Please enter a valid email address.");
        return;
      }

      // 2. Strict Email Uniqueness Check
      if (isEmailTaken(cleanEmail)) {
        setErrorMsg("This email is already registered. Please sign in instead.");
        return;
      }

      // 3. Password Check
      const passCheck = validatePasswordStrength(password);
      if (!passCheck.valid) {
        setErrorMsg(passCheck.reason || "Password must be at least 6 characters.");
        return;
      }

      if (password !== confirmPassword) {
        setErrorMsg("Passwords do not match.");
        return;
      }

      setLoading(true);
      try {
        // Call backend Brevo OTP endpoint
        const res = await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: cleanEmail,
            username: cleanUser,
            mode: "register",
            password,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
          setErrorMsg(data.error || "Failed to send verification code. Please try again.");
          return;
        }

        setTargetEmail(cleanEmail);
        setTargetUsername(cleanUser);
        setStep("otp");
        setCooldown(60);
        setSuccessMsg(`A 4-digit verification code was sent to ${cleanEmail}`);
        setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
      } catch {
        setErrorMsg("Network error sending verification code. Please try again.");
      } finally {
        setLoading(false);
      }
    } else if (activeMode === "forgot") {
      // Forgot Password - Step 1: Identifier lookup & OTP trigger
      const cleanIdentifier = loginIdentifier.trim();
      if (!cleanIdentifier) {
        setErrorMsg("Please enter your username or registered email.");
        return;
      }

      setLoading(true);
      try {
        let found = getUserByEmailOrUsername(cleanIdentifier);
        if (!found) {
          try {
            const lookupRes = await fetch("/api/auth/lookup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ identifier: cleanIdentifier }),
            });
            const lookupData = await lookupRes.json();
            if (lookupData.ok && lookupData.found && lookupData.user) {
              found = lookupData.user;
              saveUser(lookupData.user);
            }
          } catch {}
        }

        if (!found) {
          try {
            found = await fetchUserProfileFromSupabase(cleanIdentifier);
          } catch {}
        }

        const authEmail = found?.email || (cleanIdentifier.includes("@") ? cleanIdentifier.toLowerCase() : null);
        const authUsername = found?.username || cleanIdentifier;

        if (!authEmail) {
          setErrorMsg("No account found with this identifier. Please enter your registered email address.");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: authEmail,
            username: authUsername,
            mode: "forgot",
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
          setErrorMsg(data.error || "Failed to send verification code. Please try again.");
          return;
        }

        setTargetEmail(authEmail);
        setTargetUsername(authUsername);
        setStep("otp");
        setCooldown(60);
        setSuccessMsg(`A 4-digit verification code was sent to ${authEmail}`);
        setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
      } catch {
        setErrorMsg("Network error sending verification code. Please try again.");
      } finally {
        setLoading(false);
      }
    } else {
      // Login Mode: verify credentials & send 4-digit verification code
      const cleanIdentifier = loginIdentifier.trim();
      if (!cleanIdentifier) {
        setErrorMsg("Please enter your username or email.");
        return;
      }

      if (password.length < 6) {
        setErrorMsg("Password must be at least 6 characters.");
        return;
      }

      setLoading(true);
      try {
        let found = getUserByEmailOrUsername(cleanIdentifier);
        if (!found) {
          try {
            const lookupRes = await fetch("/api/auth/lookup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ identifier: cleanIdentifier, password }),
            });
            const lookupData = await lookupRes.json();
            if (lookupData.ok) {
              if (lookupData.found && lookupData.user) {
                found = lookupData.user;
                saveUser(lookupData.user);
                if (lookupData.passwordMatch === false) {
                  setErrorMsg("Incorrect password. Please try again.");
                  setLoading(false);
                  return;
                }
              } else if (!lookupData.found) {
                setErrorMsg("No account found with this username or email. Please check your credentials or register.");
                setLoading(false);
                return;
              }
            }
          } catch {}
        }

        if (!found) {
          try {
            found = await fetchUserProfileFromSupabase(cleanIdentifier);
          } catch {}
        }

        if (!found) {
          setErrorMsg("No account found with this username or email. Please check your credentials or register.");
          setLoading(false);
          return;
        }

        // If user has a password recorded, check password match
        if (found.password && found.password !== password) {
          setErrorMsg("Incorrect password. Please try again.");
          setLoading(false);
          return;
        }

        const authEmail = found.email || (cleanIdentifier.includes("@") ? cleanIdentifier.toLowerCase() : "");
        const authUsername = found.username || cleanIdentifier;

        if (!authEmail) {
          setErrorMsg("No registered email address found for this account.");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: authEmail,
            username: authUsername,
            mode: "login",
            password,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
          setErrorMsg(data.error || "Failed to send verification code. Please try again.");
          return;
        }

        setTargetEmail(authEmail);
        setTargetUsername(authUsername);
        setStep("otp");
        setCooldown(60);
        setSuccessMsg(`A 4-digit verification code was sent to ${authEmail}`);
        setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
      } catch {
        setErrorMsg("Network error sending verification code. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  }

  // Helper to extract 4-digit code from any raw text string
  function extractFourDigitCode(text: string): string | null {
    if (!text) return null;
    const clean = text.trim();
    const match = clean.match(/\b(\d{4})\b/);
    if (match && match[1]?.length === 4) return match[1];
    const onlyDigits = clean.replace(/\D/g, "");
    if (onlyDigits.length === 4) return onlyDigits;
    if (onlyDigits.length > 4) return onlyDigits.slice(0, 4);
    return null;
  }

  // Populate OTP state with 4 digits and set focus
  const applyOtpCode = useCallback((code: string) => {
    const digits = code.slice(0, 4).split("");
    const newDigits = ["", "", "", ""];
    digits.forEach((d, i) => {
      newDigits[i] = d;
    });
    setOtpDigits(newDigits);
    otpInputRefs.current[3]?.focus();
  }, []);

  // Auto-fill / Paste listener for OTP verification screen
  useEffect(() => {
    if (step !== "otp") return;

    function handleGlobalPaste(e: ClipboardEvent) {
      const text = e.clipboardData?.getData("text");
      if (!text) return;
      const code = extractFourDigitCode(text);
      if (code) {
        e.preventDefault();
        applyOtpCode(code);
      }
    }

    async function checkClipboardOnFocus() {
      if (typeof navigator === "undefined" || !navigator.clipboard?.readText) return;
      try {
        const clipText = await navigator.clipboard.readText();
        const code = extractFourDigitCode(clipText);
        if (code && code !== otpDigits.join("")) {
          applyOtpCode(code);
        }
      } catch {
        /* ignore */
      }
    }

    window.addEventListener("paste", handleGlobalPaste);
    window.addEventListener("focus", checkClipboardOnFocus);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void checkClipboardOnFocus();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("paste", handleGlobalPaste);
      window.removeEventListener("focus", checkClipboardOnFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [step, otpDigits, applyOtpCode]);

  function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text");
    const code = extractFourDigitCode(pasteData);
    if (!code) return;
    applyOtpCode(code);
  }

  function handleOtpDigitChange(index: number, val: string) {
    const clean = val.replace(/\D/g, "");
    const newDigits = [...otpDigits];

    if (clean.length > 1) {
      const pasted = clean.slice(0, 4).split("");
      pasted.forEach((ch, idx) => {
        if (idx < 4) newDigits[idx] = ch;
      });
      setOtpDigits(newDigits);
      const nextFocus = Math.min(pasted.length, 3);
      otpInputRefs.current[nextFocus]?.focus();
      return;
    }

    newDigits[index] = clean.slice(-1);
    setOtpDigits(newDigits);

    if (clean && index < 3) {
      otpInputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  }

  async function handleResendOtp() {
    if (cooldown > 0 || resending) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setResending(true);

    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || "Failed to resend verification code.");
        return;
      }

      setCooldown(60);
      setSuccessMsg("A new 4-digit code has been sent to your email.");
      setOtpDigits(["", "", "", ""]);
      otpInputRefs.current[0]?.focus();
    } catch {
      setErrorMsg("Network error resending verification code.");
    } finally {
      setResending(false);
    }
  }

  // Handle OTP Verification
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const fullOtp = otpDigits.join("");
    if (fullOtp.length !== 4) {
      setErrorMsg("Please enter the complete 4-digit verification code.");
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, otp: fullOtp }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || "Invalid verification code.");
        setLoading(false);
        return;
      }

      // If in Forgot Password flow, switch to Create New Password screen
      if (activeMode === "forgot") {
        setStep("reset-password");
        setSuccessMsg("Verification code confirmed. Please create your new password.");
        setLoading(false);
        return;
      }

      // OTP Verified successfully! Proceed with account creation / login
      if (activeMode === "register") {
        const authRes = await signUpWithEmail(targetEmail, password, targetUsername);
        if (authRes.success) {
          router.replace("/");
        } else if (authRes.error) {
          setErrorMsg(authRes.error);
        }
      } else {
        const authRes = await loginWithEmail(targetEmail, password, targetUsername);
        if (authRes.success) {
          router.replace("/");
        } else if (authRes.error) {
          setErrorMsg(authRes.error);
        }
      }
    } catch {
      setErrorMsg("Verification request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Handle Reset Password Submission
  async function handleResetPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await resetPasswordWithEmail(targetEmail, newPassword, targetUsername);
      if (res.success) {
        router.replace("/");
      } else {
        setErrorMsg(res.error || "Failed to reset password. Please try again.");
      }
    } catch {
      setErrorMsg("Error resetting password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const card = (
    <div
      id="auth-card"
      className="w-full max-w-[305px] sm:max-w-[400px] rounded-xl sm:rounded-2xl border border-white/10 bg-[#121214]/90 p-3.5 sm:p-7 text-left text-white shadow-2xl backdrop-blur-2xl transition-all duration-300 ease-out"
    >
      {/* Back button */}
      <button
        type="button"
        id="auth-back-button"
        onClick={handleBack}
        className="mb-1.5 sm:mb-4 inline-flex items-center gap-1.5 text-[10px] sm:text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft className="size-3 sm:size-3.5" />
        <span>Back</span>
      </button>

      {/* Header */}
      {step === "form" ? (
        <div key={`header-${activeMode}`} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-white">
            {activeMode === "register"
              ? "Create account"
              : activeMode === "forgot"
              ? "Reset password"
              : "Sign in"}
          </h2>
          <p className="mt-0.5 mb-2.5 sm:mt-1 sm:mb-5 text-[10.5px] sm:text-xs text-neutral-400 leading-snug sm:leading-relaxed">
            {activeMode === "register"
              ? "Join Auxy to customize your room, playlists, and player."
              : activeMode === "forgot"
              ? "Enter your email or username to receive a 4-digit reset code."
              : "Sign in with your email or username to access your music room."}
          </p>
        </div>
      ) : step === "otp" ? (
        <div key="header-otp" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="size-4 sm:size-5 text-neutral-300" />
            <h2 className="text-base sm:text-xl font-bold tracking-tight text-white">
              {activeMode === "forgot"
                ? "Reset verification"
                : activeMode === "register"
                ? "Verify account"
                : "Security verification"}
            </h2>
          </div>
          <p className="mt-0.5 mb-2.5 sm:mt-1 sm:mb-5 text-[10.5px] sm:text-xs text-neutral-400 leading-snug sm:leading-relaxed">
            Enter the 4-digit verification code sent to{" "}
            <span className="text-neutral-200 font-medium">{targetEmail}</span>
          </p>
        </div>
      ) : (
        <div key="header-reset" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2 mb-1">
            <LockKeyhole className="size-4 sm:size-5 text-neutral-300" />
            <h2 className="text-base sm:text-xl font-bold tracking-tight text-white">Create new password</h2>
          </div>
          <p className="mt-0.5 mb-2.5 sm:mt-1 sm:mb-5 text-[10.5px] sm:text-xs text-neutral-400 leading-snug sm:leading-relaxed">
            Choose a new password for{" "}
            <span className="text-neutral-200 font-medium">{targetUsername || targetEmail}</span>
          </p>
        </div>
      )}

      {/* Success alert */}
      {successMsg && (
        <div className="mb-2 sm:mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 sm:px-3 sm:py-2 text-[10.5px] sm:text-xs text-emerald-300 animate-in fade-in duration-200">
          <CheckCircle2 className="size-3.5 sm:size-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error alert */}
      {errorMsg && (
        <div className="mb-2 sm:mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 sm:px-3 sm:py-2 text-[10.5px] sm:text-xs text-red-300 animate-in fade-in duration-200">
          {errorMsg}
        </div>
      )}

      {/* Step 1: Form */}
      {step === "form" && (
        <form onSubmit={handleSubmit} className={activeMode === "register" ? "space-y-2 sm:space-y-3.5" : "space-y-2.5 sm:space-y-4"}>
          {activeMode === "register" ? (
            <>
              <div>
                <label
                  htmlFor="auth-username"
                  className="mb-0.5 sm:mb-1 block text-[10px] sm:text-xs font-medium text-neutral-300"
                >
                  Username
                </label>
                <input
                  id="auth-username"
                  type="text"
                  required
                  maxLength={16}
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.slice(0, 16))}
                  placeholder="Choose username (max 16)"
                  className="w-full h-8 sm:h-10 px-2.5 sm:px-3.5 rounded-md sm:rounded-lg bg-[#1a1a1d] border border-neutral-800 text-xs sm:text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-email"
                  className="mb-0.5 sm:mb-1 block text-[10px] sm:text-xs font-medium text-neutral-300"
                >
                  Email
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-8 sm:h-10 px-2.5 sm:px-3.5 rounded-md sm:rounded-lg bg-[#1a1a1d] border border-neutral-800 text-xs sm:text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="mb-0.5 sm:mb-1 block text-[10px] sm:text-xs font-medium text-neutral-300"
                >
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full h-8 sm:h-10 px-2.5 sm:px-3.5 rounded-md sm:rounded-lg bg-[#1a1a1d] border border-neutral-800 text-xs sm:text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-confirm-password"
                  className="mb-0.5 sm:mb-1 block text-[10px] sm:text-xs font-medium text-neutral-300"
                >
                  Confirm password
                </label>
                <input
                  id="auth-confirm-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full h-8 sm:h-10 px-2.5 sm:px-3.5 rounded-md sm:rounded-lg bg-[#1a1a1d] border border-neutral-800 text-xs sm:text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
                />
              </div>
            </>
          ) : activeMode === "forgot" ? (
            <div>
              <label
                htmlFor="auth-forgot-identifier"
                className="mb-0.5 sm:mb-1 block text-[10px] sm:text-xs font-medium text-neutral-300"
              >
                Username or Registered Email
              </label>
              <input
                id="auth-forgot-identifier"
                type="text"
                required
                autoComplete="username"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="Enter your username or email"
                className="w-full h-8.5 sm:h-10.5 px-2.5 sm:px-3.5 rounded-md sm:rounded-lg bg-[#1a1a1d] border border-neutral-800 text-xs sm:text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
              />
            </div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="auth-identifier"
                  className="mb-0.5 sm:mb-1 block text-[10px] sm:text-xs font-medium text-neutral-300"
                >
                  Username or Email
                </label>
                <input
                  id="auth-identifier"
                  type="text"
                  required
                  autoComplete="username"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="Username or email address"
                  className="w-full h-8.5 sm:h-10.5 px-2.5 sm:px-3.5 rounded-md sm:rounded-lg bg-[#1a1a1d] border border-neutral-800 text-xs sm:text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                  <label
                    htmlFor="auth-password"
                    className="block text-[10px] sm:text-xs font-medium text-neutral-300"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    id="auth-forgot-password-link"
                    onClick={() => handleSwitch("forgot")}
                    className="text-[10px] sm:text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full h-8.5 sm:h-10.5 px-2.5 sm:px-3.5 rounded-md sm:rounded-lg bg-[#1a1a1d] border border-neutral-800 text-xs sm:text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
                />
              </div>
            </>
          )}

          <Button
            id="auth-submit-button"
            type="submit"
            disabled={loading}
            className="w-full h-8.5 sm:h-10 mt-2 sm:mt-3 bg-[#ededed] hover:bg-white active:scale-[0.99] text-neutral-950 font-semibold text-xs sm:text-sm rounded-md sm:rounded-lg transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="size-3.5 sm:size-4 animate-spin" />
                <span>Sending verification code...</span>
              </>
            ) : (
              <span key={`btn-text-${activeMode}`} className="animate-in fade-in duration-200">
                {activeMode === "register"
                  ? "Create account"
                  : activeMode === "forgot"
                  ? "Send verification code"
                  : "Sign in"}
              </span>
            )}
          </Button>
        </form>
      )}

      {/* Step 2: 4-Digit OTP Verification Screen */}
      {step === "otp" && (
        <form onSubmit={handleVerifyOtp} className="space-y-3 sm:space-y-4 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center justify-center gap-2 sm:gap-3 my-2">
              {otpDigits.map((digit, idx) => (
                <input
                  key={`otp-box-${idx}`}
                  ref={(el) => {
                    otpInputRefs.current[idx] = el;
                  }}
                  id={`otp-digit-${idx}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete={idx === 0 ? "one-time-code" : "off"}
                  pattern="[0-9]*"
                  maxLength={4}
                  value={digit}
                  onPaste={handleOtpPaste}
                  onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  className="w-10 h-11 sm:w-13 sm:h-14 text-center text-lg sm:text-2xl font-bold bg-[#1a1a1d] border border-neutral-700/80 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all shadow-inner"
                />
              ))}
            </div>
            <p className="text-[10px] sm:text-[11px] text-neutral-500 text-center mt-2 leading-relaxed">
              If you don&apos;t see the email in your Inbox, please check your <strong>Spam / Junk folder</strong>.
            </p>
          </div>

          <Button
            id="otp-verify-button"
            type="submit"
            disabled={loading || otpDigits.join("").length !== 4}
            className="w-full h-9 sm:h-10 bg-[#ededed] hover:bg-white active:scale-[0.99] text-neutral-950 font-semibold text-xs sm:text-sm rounded-lg transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="size-3.5 sm:size-4 animate-spin" />
                <span>Verifying code...</span>
              </>
            ) : (
              <span>Verify & Continue</span>
            )}
          </Button>

          {/* Resend Action with 60s cooldown */}
          <div className="flex items-center justify-center text-[11px] sm:text-xs text-neutral-400 pt-1">
            {cooldown > 0 ? (
              <span className="text-neutral-500 font-mono text-[10px] sm:text-[11px]">Resend code in {cooldown}s</span>
            ) : (
              <button
                type="button"
                id="otp-resend-btn"
                onClick={handleResendOtp}
                disabled={resending}
                className="inline-flex items-center gap-1.5 font-medium text-neutral-300 hover:text-white transition-colors cursor-pointer"
              >
                {resending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                <span>Resend code</span>
              </button>
            )}
          </div>
        </form>
      )}

      {/* Step 3: Create New Password Screen (for Forgot Password) */}
      {step === "reset-password" && (
        <form onSubmit={handleResetPasswordSubmit} className="space-y-3 sm:space-y-4 animate-in fade-in duration-300">
          <div>
            <label
              htmlFor="auth-new-password"
              className="mb-1 block text-[11px] sm:text-xs font-medium text-neutral-300"
            >
              New password
            </label>
            <input
              id="auth-new-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 6 chars)"
              className="w-full h-9 sm:h-10.5 px-3 sm:px-3.5 rounded-lg bg-[#1a1a1d] border border-neutral-800 text-xs sm:text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="auth-confirm-new-password"
              className="mb-1 block text-[11px] sm:text-xs font-medium text-neutral-300"
            >
              Confirm new password
            </label>
            <input
              id="auth-confirm-new-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full h-9 sm:h-10.5 px-3 sm:px-3.5 rounded-lg bg-[#1a1a1d] border border-neutral-800 text-xs sm:text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
            />
          </div>

          <Button
            id="auth-reset-password-btn"
            type="submit"
            disabled={loading}
            className="w-full h-9 sm:h-10 mt-2.5 sm:mt-3 bg-[#ededed] hover:bg-white active:scale-[0.99] text-neutral-950 font-semibold text-xs sm:text-sm rounded-lg transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="size-3.5 sm:size-4 animate-spin" />
                <span>Updating password...</span>
              </>
            ) : (
              <span>Reset Password & Sign In</span>
            )}
          </Button>
        </form>
      )}

      {/* Switch mode */}
      {step === "form" && (
        <div className="mt-4 sm:mt-5 text-center text-[11px] sm:text-xs text-neutral-400">
          {activeMode === "register" ? (
            <span className="inline-flex items-center justify-center">
              Already have an account?{" "}
              <button
                type="button"
                id="auth-switch-to-login"
                onClick={() => handleSwitch("login")}
                className="font-medium text-white hover:text-white/80 hover:underline cursor-pointer ml-1.5 transition-colors"
              >
                Sign in
              </button>
            </span>
          ) : activeMode === "forgot" ? (
            <span className="inline-flex items-center justify-center">
              Remembered your password?{" "}
              <button
                type="button"
                id="auth-switch-to-login-from-forgot"
                onClick={() => handleSwitch("login")}
                className="font-medium text-white hover:text-white/80 hover:underline cursor-pointer ml-1.5 transition-colors"
              >
                Sign in
              </button>
            </span>
          ) : (
            <span className="inline-flex items-center justify-center">
              New here?{" "}
              <button
                type="button"
                id="auth-switch-to-register"
                onClick={() => handleSwitch("register")}
                className="font-medium text-white hover:text-white/80 hover:underline cursor-pointer ml-1.5 transition-colors"
              >
                Sign up
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (compact) return card;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-[#070709] px-3 sm:px-4 py-4 sm:py-8 text-white selection:bg-white/20">
      {card}
    </div>
  );
}
