"use client";

import Image from "next/image";
import Link from "next/link";
import { type CSSProperties, type FormEvent, useEffect, useMemo, useState } from "react";
import { AdminDashboardShell } from "./admin-dashboard-shell";
import styles from "./admin-auth-shell.module.css";

export type AdminAuthStep = "dashboard" | "forgot" | "login" | "reset" | "verify";

type AdminAuthShellProps = {
  initialStep?: AdminAuthStep;
  requireSession?: boolean;
};

type AdminApiResponse = {
  admin?: {
    email?: string;
  };
  authenticated?: boolean;
  csrfToken?: string | null;
  error?: string;
  message?: string;
  nextStep?: "otp";
  ok?: boolean;
};

type MessageState = {
  text: string;
  tone: "error" | "success";
} | null;

const GENERIC_AUTH_ERROR = "Invalid credentials or unauthorized admin access.";
const FORGOT_PASSWORD_SUCCESS = "If this email is authorized, reset instructions will be sent.";

export function AdminAuthShell({
  initialStep = "login",
  requireSession = false
}: AdminAuthShellProps) {
  const [step, setStep] = useState<AdminAuthStep>(initialStep);
  const [checkingSession, setCheckingSession] = useState(true);
  const [csrfToken, setCsrfToken] = useState("");
  const [sessionEmail, setSessionEmail] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginMessage, setLoginMessage] = useState<MessageState>(null);
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  const [otpEmail, setOtpEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpMessage, setOtpMessage] = useState<MessageState>(null);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMessage, setForgotMessage] = useState<MessageState>(null);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetMessage, setResetMessage] = useState<MessageState>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      setCheckingSession(true);

      try {
        const response = await fetch("/api/admin/auth/session", {
          cache: "no-store",
          credentials: "include"
        });
        const data = (await response.json()) as AdminApiResponse;

        if (cancelled) return;

        if (response.ok && data.authenticated && typeof data.admin?.email === "string") {
          setSessionEmail(data.admin.email);
          setCsrfToken(typeof data.csrfToken === "string" ? data.csrfToken : "");

          if (initialStep !== "dashboard" && window.location.pathname !== "/admin/dashboard") {
            window.location.replace(getSafeAdminNextPath() || "/admin/dashboard");
            return;
          }

          setStep("dashboard");
        } else {
          setSessionEmail("");
          setCsrfToken("");

          if (requireSession) {
            window.location.replace("/admin/login");
            return;
          }

          setStep(initialStep === "dashboard" ? "login" : initialStep);
        }
      } catch {
        if (!cancelled) {
          setSessionEmail("");
          setCsrfToken("");

          if (requireSession) {
            window.location.replace("/admin/login");
            return;
          }

          setStep(initialStep === "dashboard" ? "login" : initialStep);
        }
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [initialStep, requireSession]);

  useEffect(() => {
    const googleStatus = new URLSearchParams(window.location.search).get("google");
    if (!googleStatus) return;

    const messageByStatus: Record<string, string> = {
      cancelled: "Google sign-in was cancelled.",
      failed: GENERIC_AUTH_ERROR,
      not_configured: GENERIC_AUTH_ERROR,
      rate_limited: "Too many admin sign-in attempts. Please try again shortly.",
      unauthorized: GENERIC_AUTH_ERROR
    };

    const frame = window.requestAnimationFrame(() => {
      setLoginMessage({
        text: messageByStatus[googleStatus] || GENERIC_AUTH_ERROR,
        tone: "error"
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (otpCooldown <= 0) return;

    const timer = window.setTimeout(() => {
      setOtpCooldown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [otpCooldown]);

  const passwordChecks = useMemo(() => getPasswordChecks(newPassword), [newPassword]);
  const passwordStrength = Object.values(passwordChecks).filter(Boolean).length;
  const passwordStrengthStyle = {
    "--admin-strength": `${passwordStrength * 20}%`
  } as CSSProperties;

  async function handleEmailCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginMessage(null);

    if (!isValidEmail(loginEmail)) {
      setLoginMessage({ text: "Enter a valid admin email.", tone: "error" });
      return;
    }

    setEmailSubmitting(true);

    try {
      const data = await postAdminApi("/api/admin/auth/email/start", {
        email: loginEmail
      });

      setOtpEmail(loginEmail.trim().toLowerCase());
      setOtp("");
      setOtpMessage({
        text: data.message || "If this email is authorized, a one-time code will be sent.",
        tone: "success"
      });
      setStep("verify");
    } catch {
      setLoginMessage({
        text: GENERIC_AUTH_ERROR,
        tone: "error"
      });
    } finally {
      setEmailSubmitting(false);
    }
  }

  async function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOtpMessage(null);

    const emailForOtp = otpEmail || loginEmail;
    if (!isValidEmail(emailForOtp) || !/^\d{6}$/.test(otp)) {
      setOtpMessage({ text: GENERIC_AUTH_ERROR, tone: "error" });
      return;
    }

    setOtpSubmitting(true);

    try {
      const data = await postAdminApi("/api/admin/auth/email/verify", {
        email: emailForOtp,
        otp
      });

      if (!data.ok || !data.authenticated || typeof data.admin?.email !== "string") {
        throw new Error(data.error || GENERIC_AUTH_ERROR);
      }

      setSessionEmail(data.admin.email);
      setCsrfToken(typeof data.csrfToken === "string" ? data.csrfToken : "");
      setOtp("");
      window.location.replace(getSafeAdminNextPath() || "/admin/dashboard");
    } catch {
      setOtpMessage({ text: GENERIC_AUTH_ERROR, tone: "error" });
    } finally {
      setOtpSubmitting(false);
    }
  }

  async function handleResendOtp() {
    const emailForOtp = otpEmail || loginEmail;
    if (!isValidEmail(emailForOtp) || otpCooldown > 0) return;

    setOtpCooldown(30);
    setOtpMessage(null);

    try {
      const data = await postAdminApi("/api/admin/auth/email/start", {
        email: emailForOtp
      });

      setOtpMessage({
        text: data.message || "If this admin is authorized, a verification code will be sent.",
        tone: "success"
      });
    } catch {
      setOtpMessage({
        text: "If this admin is authorized, a verification code will be sent.",
        tone: "success"
      });
    }
  }

  async function handleForgotSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setForgotMessage(null);

    if (!isValidEmail(forgotEmail)) {
      setForgotMessage({ text: "Enter a valid admin email.", tone: "error" });
      return;
    }

    setForgotSubmitting(true);

    try {
      const data = await postAdminApi("/api/admin/auth/forgot-password", {
        email: forgotEmail
      });

      setForgotMessage({
        text: data.message || FORGOT_PASSWORD_SUCCESS,
        tone: "success"
      });
    } catch {
      setForgotMessage({ text: FORGOT_PASSWORD_SUCCESS, tone: "success" });
    } finally {
      setForgotSubmitting(false);
    }
  }

  async function handleResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetMessage(null);

    if (!Object.values(passwordChecks).every(Boolean) || newPassword !== confirmPassword) {
      setResetMessage({
        text: "Password does not meet the admin security requirements.",
        tone: "error"
      });
      return;
    }

    setResetSubmitting(true);

    try {
      const data = await postAdminApi("/api/admin/auth/reset-password", {
        confirmPassword,
        newPassword
      });

      setResetMessage({
        text: data.message || GENERIC_AUTH_ERROR,
        tone: data.ok ? "success" : "error"
      });
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setResetMessage({
        text: GENERIC_AUTH_ERROR,
        tone: "error"
      });
    } finally {
      setResetSubmitting(false);
    }
  }

  async function handleLogout() {
    try {
      await postAdminApi("/api/admin/auth/logout", {}, csrfToken);
    } finally {
      setCsrfToken("");
      setSessionEmail("");
      setStep("login");
      window.location.replace("/admin/login");
    }
  }

  function renderPanel() {
    if (checkingSession) {
      return (
        <section className={styles.authPanel} aria-busy="true" aria-live="polite">
          <p className={styles.eyebrow}>Admin Security</p>
          <h1 className={styles.title}>Checking Session</h1>
          <p className={styles.subtitle}>Verifying whether an admin session already exists.</p>
          <div className={styles.loadingBars} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>
      );
    }

    if (step === "dashboard") {
      return renderDashboard();
    }

    if (step === "verify") {
      return renderVerify();
    }

    if (step === "forgot") {
      return renderForgotPassword();
    }

    if (step === "reset") {
      return renderResetPassword();
    }

    return renderLogin();
  }

  function renderLogin() {
    return (
      <section className={styles.authPanel} aria-labelledby="admin-login-title">
        <p className={styles.eyebrow}>Secure Admin Access</p>
        <h1 className={styles.title} id="admin-login-title">
          Admin Login
        </h1>
        <p className={styles.subtitle}>Secure access for authorized administrators only.</p>

        <div className={styles.form}>
          {loginMessage ? <StatusMessage message={loginMessage} /> : null}

          <a className={styles.googleButton} href="/api/admin/auth/google/start">
            Continue with Google
          </a>
          {/* TODO: Keep Google OAuth restricted by ADMIN_ALLOWED_EMAILS and final admin role checks. */}
        </div>

        <div className={styles.authDivider} aria-hidden="true">
          <span />
          <strong>or</strong>
          <span />
        </div>

        <form className={styles.form} noValidate onSubmit={handleEmailCodeSubmit}>
          <label className={styles.field} htmlFor="admin-email">
            <span>Admin email</span>
            <input
              autoComplete="email"
              id="admin-email"
              inputMode="email"
              name="email"
              onChange={(event) => setLoginEmail(event.target.value)}
              required
              type="email"
              value={loginEmail}
            />
          </label>

          <button className={styles.primaryButton} disabled={emailSubmitting} type="submit">
            {emailSubmitting ? "Sending code..." : "Send one-time code"}
          </button>
        </form>

        <p className={styles.securityNotice}>
          Authorized access only. Admin activity may be logged for security.
        </p>
      </section>
    );
  }

  function renderVerify() {
    const emailForOtp = otpEmail || loginEmail;

    return (
      <section className={styles.authPanel} aria-labelledby="admin-verify-title">
        <p className={styles.eyebrow}>Multi-Factor Check</p>
        <h1 className={styles.title} id="admin-verify-title">
          Verify Your Identity
        </h1>
        <p className={styles.subtitle}>
          Enter the one-time code sent to your registered admin email.
        </p>

        <form className={styles.form} noValidate onSubmit={handleOtpSubmit}>
          <label className={styles.field} htmlFor="admin-otp-email">
            <span>Admin email</span>
            <input
              autoComplete="email"
              id="admin-otp-email"
              inputMode="email"
              name="email"
              onChange={(event) => {
                setOtpEmail(event.target.value);
                setLoginEmail(event.target.value);
              }}
              required
              type="email"
              value={emailForOtp}
            />
          </label>

          <label className={styles.field} htmlFor="admin-otp">
            <span>6-digit verification code</span>
            <input
              autoComplete="one-time-code"
              className={styles.otpInput}
              id="admin-otp"
              inputMode="numeric"
              name="otp"
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              onPaste={(event) => {
                const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                if (!digits) return;

                event.preventDefault();
                setOtp(digits);
              }}
              pattern="[0-9]*"
              required
              type="text"
              value={otp}
            />
          </label>

          {otpMessage ? <StatusMessage message={otpMessage} /> : null}

          <button className={styles.primaryButton} disabled={otpSubmitting} type="submit">
            {otpSubmitting ? "Verifying..." : "Verify & Enter Admin Panel"}
          </button>

          <div className={styles.linkRow}>
            <button
              className={styles.linkButton}
              disabled={otpCooldown > 0}
              onClick={handleResendOtp}
              type="button"
            >
              {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : "Resend OTP"}
            </button>
            <Link
              className={styles.textLink}
              href="/admin/login"
              onClick={() => setStep("login")}
              prefetch={false}
            >
              Back to login
            </Link>
          </div>
        </form>
        {/* TODO: Connect real OTP/MFA provider with expiry, attempt limits, rate limiting, and audit logs. */}
      </section>
    );
  }

  function renderForgotPassword() {
    return (
      <section className={styles.authPanel} aria-labelledby="admin-forgot-title">
        <p className={styles.eyebrow}>Account Recovery</p>
        <h1 className={styles.title} id="admin-forgot-title">
          Reset Admin Password
        </h1>
        <p className={styles.subtitle}>
          Enter your admin email. If the account is authorized, reset instructions will be sent.
        </p>

        <form className={styles.form} noValidate onSubmit={handleForgotSubmit}>
          <label className={styles.field} htmlFor="admin-forgot-email">
            <span>Admin email</span>
            <input
              autoComplete="email"
              id="admin-forgot-email"
              inputMode="email"
              name="email"
              onChange={(event) => setForgotEmail(event.target.value)}
              required
              type="email"
              value={forgotEmail}
            />
          </label>

          {forgotMessage ? <StatusMessage message={forgotMessage} /> : null}

          <button className={styles.primaryButton} disabled={forgotSubmitting} type="submit">
            {forgotSubmitting ? "Sending..." : "Send Reset Instructions"}
          </button>

          <Link
            className={styles.textLink}
            href="/admin/login"
            onClick={() => setStep("login")}
            prefetch={false}
          >
            Back to login
          </Link>
        </form>
        {/* TODO: Connect secure one-time reset token flow with expiry, rate limiting, audit logs, and session invalidation. */}
      </section>
    );
  }

  function renderResetPassword() {
    return (
      <section className={styles.authPanel} aria-labelledby="admin-reset-title">
        <p className={styles.eyebrow}>Password Update</p>
        <h1 className={styles.title} id="admin-reset-title">
          Reset Admin Password
        </h1>
        <p className={styles.subtitle}>
          Set a strong password. Real token validation will be connected before production admin
          use.
        </p>

        <form className={styles.form} noValidate onSubmit={handleResetSubmit}>
          <label className={styles.field} htmlFor="admin-new-password">
            <span>New password</span>
            <input
              autoComplete="new-password"
              id="admin-new-password"
              name="new-password"
              onChange={(event) => setNewPassword(event.target.value)}
              required
              type="password"
              value={newPassword}
            />
          </label>

          <label className={styles.field} htmlFor="admin-confirm-password">
            <span>Confirm password</span>
            <input
              autoComplete="new-password"
              id="admin-confirm-password"
              name="confirm-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </label>

          <div className={styles.strengthMeter} style={passwordStrengthStyle} aria-hidden="true">
            <span />
          </div>

          <ul className={styles.passwordChecklist} aria-label="Password requirements">
            <Requirement checked={passwordChecks.hasMinLength} label="minimum 12 characters" />
            <Requirement checked={passwordChecks.hasUppercase} label="uppercase letter" />
            <Requirement checked={passwordChecks.hasLowercase} label="lowercase letter" />
            <Requirement checked={passwordChecks.hasNumber} label="number" />
            <Requirement checked={passwordChecks.hasSpecial} label="special character" />
          </ul>

          {resetMessage ? <StatusMessage message={resetMessage} /> : null}

          <button className={styles.primaryButton} disabled={resetSubmitting} type="submit">
            {resetSubmitting ? "Updating..." : "Update Password"}
          </button>

          <Link
            className={styles.textLink}
            href="/admin/login"
            onClick={() => setStep("login")}
            prefetch={false}
          >
            Back to login
          </Link>
        </form>
        {/* TODO: Connect reset-token validation, strong password hashing, and session invalidation. */}
      </section>
    );
  }

  function renderDashboard() {
    return (
      <section
        className={`${styles.authPanel} ${styles.dashboardPanel}`}
        aria-labelledby="admin-dashboard-title"
      >
        <AdminDashboardShell
          csrfToken={csrfToken}
          onLogout={handleLogout}
          sessionEmail={sessionEmail}
        />
      </section>
    );
  }

  return (
    <main className={styles.adminPage}>
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={`${styles.shell} ${step === "dashboard" ? styles.shellDashboard : ""}`}>
        {step === "dashboard" ? null : (
          <aside className={styles.brandPanel} aria-label="YW Coach admin security">
            <div className={styles.logoMark}>
              <Image
                alt=""
                height={994}
                priority
                src="/images/yw-nutritech-logo.png"
                width={1302}
              />
            </div>
            <p className={styles.brandKicker}>YW Coach Admin</p>
            <h2>Controlled access for coach platform operations.</h2>
            <p>
              This foundation is structured for allowlisted admins, MFA, guarded APIs, audit trails,
              and future dashboard modules.
            </p>
          </aside>
        )}

        {renderPanel()}
      </div>
    </main>
  );
}

function StatusMessage({ message }: { message: Exclude<MessageState, null> }) {
  return (
    <p className={styles.statusMessage} data-tone={message.tone} role="status">
      {message.text}
    </p>
  );
}

function Requirement({ checked, label }: { checked: boolean; label: string }) {
  return (
    <li data-complete={checked}>
      <span aria-hidden="true">{checked ? "OK" : "-"}</span>
      {label}
    </li>
  );
}

async function postAdminApi(endpoint: string, payload: Record<string, unknown>, csrfToken = "") {
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };

  if (csrfToken) {
    headers["x-yw-admin-csrf"] = csrfToken;
  }

  const response = await fetch(endpoint, {
    body: JSON.stringify(payload),
    cache: "no-store",
    credentials: "include",
    headers,
    method: "POST"
  });
  const data = (await response.json().catch(() => ({}))) as AdminApiResponse;

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || GENERIC_AUTH_ERROR);
  }

  return data;
}

function getPasswordChecks(password: string) {
  return {
    hasLowercase: /[a-z]/.test(password),
    hasMinLength: password.length >= 12,
    hasNumber: /\d/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
    hasUppercase: /[A-Z]/.test(password)
  };
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
}

function getSafeAdminNextPath() {
  if (typeof window === "undefined") return "";

  const next = new URLSearchParams(window.location.search).get("next") || "";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.length > 700) {
    return "";
  }

  try {
    const nextUrl = new URL(next, window.location.origin);
    if (nextUrl.origin !== window.location.origin) return "";

    const isAdminPage = nextUrl.pathname === "/admin/dashboard";
    const isBackupDownload =
      nextUrl.pathname === "/api/admin/backup-cleanup" &&
      nextUrl.searchParams.has("download") &&
      (nextUrl.searchParams.get("format") === "csv" ||
        nextUrl.searchParams.get("format") === "xls" ||
        !nextUrl.searchParams.has("format"));

    return isAdminPage || isBackupDownload ? `${nextUrl.pathname}${nextUrl.search}` : "";
  } catch {
    return "";
  }
}
