"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SUPPORT_EMAIL,
  DEFAULT_SUPPORT_MESSAGE,
  DEFAULT_SUPPORT_NAME,
  DEFAULT_SUPPORT_PENDING_MESSAGE,
  DEFAULT_SUPPORT_PHONE,
  DEFAULT_SUPPORT_WHATSAPP,
  createSupportErrorReference,
  getPublicSupportErrorCode,
  logWebsiteError,
  type PublicWebsiteErrorCategory
} from "../../lib/error-reporting";
import styles from "./contact-support-fallback.module.css";

export type PublicSupportContact = {
  email?: string;
  imageUrl?: string;
  name?: string;
  phone?: string;
  supportText?: string;
  whatsappLink?: string;
};

type ContactSupportFallbackProps = {
  category: PublicWebsiteErrorCategory;
  coachSlug?: string;
  contact?: PublicSupportContact | null;
  funnelStep?: string;
  logOnMount?: boolean;
  message?: string;
  onReset?: () => void;
  referenceId?: string;
  safeMessage?: string;
  technicalDetails?: string;
  title?: string;
  userAction: string;
};

export function ContactSupportFallback({
  category,
  coachSlug,
  contact,
  funnelStep,
  logOnMount = true,
  message,
  onReset,
  referenceId,
  safeMessage,
  technicalDetails,
  title = "Something went wrong",
  userAction
}: ContactSupportFallbackProps) {
  const errorCode = getPublicSupportErrorCode(category);
  const stableReferenceId = useMemo(
    () => referenceId || createSupportErrorReference(category, coachSlug || userAction),
    [category, coachSlug, referenceId, userAction]
  );
  const support = getResolvedSupport(contact);
  const [copyStatus, setCopyStatus] = useState("");
  const displayMessage =
    message ||
    (support.source === "coach" ? "Please contact your coach for help." : DEFAULT_SUPPORT_MESSAGE);

  useEffect(() => {
    if (!logOnMount) return;

    void logWebsiteError({
      category,
      coachSlug,
      errorCode,
      funnelStep,
      missingSupportFields: support.missingFields,
      referenceId: stableReferenceId,
      safeMessage: safeMessage || displayMessage,
      supportSource: support.source,
      technicalDetails,
      userAction
    });
  }, [
    category,
    coachSlug,
    displayMessage,
    errorCode,
    funnelStep,
    logOnMount,
    safeMessage,
    stableReferenceId,
    support.missingFields,
    support.source,
    technicalDetails,
    userAction
  ]);

  useEffect(() => {
    if (!copyStatus) return;

    const timeout = window.setTimeout(() => setCopyStatus(""), 1800);

    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  async function copyErrorCode() {
    try {
      await window.navigator.clipboard.writeText(errorCode);
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Copy unavailable");
    }
  }

  return (
    <main className={styles.shell}>
      <section className={styles.panel} aria-labelledby="support-fallback-title">
        <div className={styles.brandBar}>
          <Link className={styles.brand} href="/" prefetch={false}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="YW Nutritech" src="/images/yw-nutritech-logo.png" />
            <span>
              <strong>YW Nutritech</strong>
              <small>Support fallback</small>
            </span>
          </Link>
          <div className={styles.codeActions}>
            <code className={styles.codePill}>Error Code: {errorCode}</code>
            <button onClick={copyErrorCode} type="button">
              Copy Code
            </button>
            {copyStatus ? <span aria-live="polite">{copyStatus}</span> : null}
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.message}>
            <p className={styles.kicker}>Contact Support</p>
            <h1 id="support-fallback-title">{title}</h1>
            <p>{displayMessage}</p>
          </div>

          <aside className={styles.supportCard} aria-label="Support contact">
            <div className={styles.supportIdentity}>
              <div className={styles.avatar}>
                {support.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={`${support.name} support profile`} src={support.imageUrl} />
                ) : (
                  <span>{support.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div>
                <h2>{support.name}</h2>
                <p>{support.supportText}</p>
              </div>
            </div>

            <div className={styles.credentials}>
              {support.phone ? (
                <a href={`tel:${support.phone.replace(/[^\d+]/g, "")}`}>
                  <span>Phone</span>
                  <strong>{support.phone}</strong>
                </a>
              ) : null}
              {support.whatsappLink ? (
                <a href={support.whatsappLink} rel="noreferrer" target="_blank">
                  <span>WhatsApp</span>
                  <strong>Contact on WhatsApp</strong>
                </a>
              ) : null}
              {support.email ? (
                <a href={support.emailHref}>
                  <span>Email</span>
                  <strong>{support.email}</strong>
                </a>
              ) : null}
              {!support.email && !support.phone && !support.whatsappLink ? (
                <div className={styles.pending}>
                  <span>Support</span>
                  <strong>{DEFAULT_SUPPORT_PENDING_MESSAGE}</strong>
                </div>
              ) : null}
            </div>

            <div className={styles.actions}>
              <a href={support.primaryHref}>Contact Support</a>
              <Link href="/" prefetch={false}>
                Go Back Home
              </Link>
              {onReset ? (
                <button onClick={onReset} type="button">
                  Try Again
                </button>
              ) : null}
            </div>

            <p className={styles.note}>
              Public error details are limited for safety. No admin-only data or technical trace is
              shown here. Reference: {stableReferenceId}
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}

function getResolvedSupport(contact?: PublicSupportContact | null) {
  const missingFields: string[] = [];
  const hasCoachContact = Boolean(contact?.email || contact?.phone || contact?.whatsappLink);
  const email = hasCoachContact ? contact?.email || "" : DEFAULT_SUPPORT_EMAIL;
  const phone = hasCoachContact ? contact?.phone || "" : DEFAULT_SUPPORT_PHONE;
  const whatsappLink = hasCoachContact ? contact?.whatsappLink || "" : DEFAULT_SUPPORT_WHATSAPP;
  const source = hasCoachContact ? ("coach" as const) : ("default" as const);
  const name = hasCoachContact ? contact?.name || "Coach Support" : DEFAULT_SUPPORT_NAME;

  if (hasCoachContact) {
    if (!contact?.email) missingFields.push("coach email");
    if (!contact?.phone) missingFields.push("coach phone");
    if (!contact?.whatsappLink) missingFields.push("coach WhatsApp");
  } else {
    if (!DEFAULT_SUPPORT_EMAIL) missingFields.push("default support email");
    if (!DEFAULT_SUPPORT_PHONE) missingFields.push("default support phone");
    if (!DEFAULT_SUPPORT_WHATSAPP) missingFields.push("default support WhatsApp");
  }

  const emailHref = email ? `mailto:${email}?subject=${encodeURIComponent("YW support request")}` : "";

  return {
    email,
    emailHref,
    imageUrl: hasCoachContact ? contact?.imageUrl || "" : "",
    missingFields,
    name,
    phone,
    primaryHref: whatsappLink || emailHref || "/",
    source,
    supportText:
      contact?.supportText ||
      (hasCoachContact ? "Need help? Contact your coach directly." : DEFAULT_SUPPORT_MESSAGE),
    whatsappLink
  };
}
