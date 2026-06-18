"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PublicCoachSitePage } from "../../components/coach/public-coach-site-page";
import type {
  CoachTemplatePreviewInspectSection,
  CoachTemplatePreviewInspectTarget
} from "../../components/coach/public-coach-site-page";
import {
  buildCoachSiteFromShopState,
  createShopContent,
  EMPTY_SHOP_BUILDER_STATE,
  normalizeShopBuilderState,
  SHOP_BUILDER_STEPS,
  validateShopBuilderState,
  type ShopBuilderState,
  type ShopValidationIssue
} from "../../lib/shop-builder";
import { prepareCoachHeroPhotoForUpload } from "../../lib/client/coach-photo-background-removal";
import { isUploadedVideoSource, normalizeVideoEmbedUrl } from "../../lib/video-links";
import styles from "./shop-builder.module.css";

const STORAGE_KEY = "ywcoach-shop-builder-draft-v1";
const CHECKOUT_IDEMPOTENCY_STORAGE_KEY = "ywcoach-shop-checkout-idempotency-v1";
const ORDER_ACCESS_KEY_STORAGE_KEY = "ywcoach-shop-order-access-key-v1";
const SHOP_PHOTO_MAX_BYTES = 12 * 1024 * 1024;
const SHOP_VIDEO_MAX_BYTES = 24 * 1024 * 1024;
const SHOP_PHOTO_PROCESS_MAX_EDGE = 1800;
const PHOTO_UPLOAD_ACCEPT =
  ".jpg,.jpeg,.jpe,.jfif,.png,.webp,.avif,.gif,.heic,.heif,.bmp,.tif,.tiff,image/jpeg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif,image/bmp,image/tiff";
const ALLOWED_PHOTO_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".heic",
  ".heif",
  ".jfif",
  ".jpe",
  ".jpeg",
  ".jpg",
  ".png",
  ".tif",
  ".tiff",
  ".webp"
]);
const ALLOWED_PHOTO_TYPES = new Set([
  "image/avif",
  "image/bmp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/pjpeg",
  "image/png",
  "image/tiff",
  "image/webp",
  "image/x-ms-bmp",
  "image/x-png"
]);

type CheckoutResponse = {
  accessKey?: string;
  error?: string;
  issues?: ShopValidationIssue[];
  ok?: boolean;
  order?: PublicShopOrder;
  redirectUrl?: string;
};

type MediaUploadResponse = {
  error?: string;
  media?: {
    mediaType: "image" | "video";
    objectKey: string;
    publicUrl: string;
    sizeBytes: number;
  };
  ok?: boolean;
};

type PublicShopOrder = {
  accessKey?: string;
  coachName: string;
  lockedAt?: string | null;
  orderId: string;
  paymentStatus?: string;
  publicUrl: string;
  publishedAt?: string | null;
  siteStatus: string;
  state?: ShopBuilderState;
  workflowStage?: string;
};

type InitialShopDraft = {
  hasStoredDraft: boolean;
  message: string;
  state: ShopBuilderState;
};

type DraftPersistMode = "autosave" | "manual" | "start";

type AutoSaveStatus = "idle" | "error" | "saved" | "saving";

function readInitialShopDraft(): InitialShopDraft {
  if (typeof window === "undefined") {
    return { hasStoredDraft: false, message: "", state: EMPTY_SHOP_BUILDER_STATE };
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { hasStoredDraft: false, message: "", state: EMPTY_SHOP_BUILDER_STATE };
    const restoredState = normalizeShopBuilderState(JSON.parse(stored) as Partial<ShopBuilderState>);

    return {
      hasStoredDraft: !isPristineShopBuilderState(restoredState),
      message: "",
      state: restoredState
    };
  } catch {
    return {
      hasStoredDraft: false,
      message: "Draft recovery was unavailable, but you can continue safely.",
      state: EMPTY_SHOP_BUILDER_STATE
    };
  }
}

function getStableShopIdempotencyKey(orderId: string) {
  if (orderId.trim()) return orderId.trim();
  if (typeof window === "undefined") return undefined;

  const existing = window.localStorage.getItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY);
  if (existing) return existing;

  const next =
    typeof window.crypto?.randomUUID === "function"
      ? `shop-client-${window.crypto.randomUUID()}`
      : `shop-client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY, next);
  return next;
}

function shouldRefreshGeneratedShopContent(
  patch: Partial<ShopBuilderState>
) {
  const touchesIdentity =
    Object.hasOwn(patch, "coachName") ||
    Object.hasOwn(patch, "niche") ||
    Object.hasOwn(patch, "location") ||
    Object.hasOwn(patch, "shortBio") ||
    Object.hasOwn(patch, "bio");

  return touchesIdentity;
}

function isPristineShopBuilderState(state: ShopBuilderState) {
  return (
    !state.coachName.trim() &&
    !state.niche.trim() &&
    !state.location.trim() &&
    !state.shortBio.trim() &&
    !state.bio.trim() &&
    !state.email.trim() &&
    !state.coachPhone.trim() &&
    !state.contactLink.trim() &&
    !state.photoUrl.trim() &&
    !state.videoUrl.trim() &&
    !state.orderId.trim() &&
    state.currentStep === EMPTY_SHOP_BUILDER_STATE.currentStep
  );
}

export function ShopBuilderClient() {
  const [state, setState] = useState<ShopBuilderState>(EMPTY_SHOP_BUILDER_STATE);
  const [builderStarted, setBuilderStarted] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [recoveredDraftAvailable, setRecoveredDraftAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startingBuilder, setStartingBuilder] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("idle");
  const [autoSaveText, setAutoSaveText] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [issues, setIssues] = useState<ShopValidationIssue[]>([]);
  const [inspectOn, setInspectOn] = useState(false);
  const [lockedOrder, setLockedOrder] = useState<PublicShopOrder | null>(null);
  const [lockCheckDone, setLockCheckDone] = useState(true);
  const [resumeAccessKey, setResumeAccessKey] = useState("");
  const [resumeChecked, setResumeChecked] = useState(false);
  const [selectedScope, setSelectedScope] = useState<CoachTemplatePreviewInspectSection | null>(
    null
  );
  const [draftText, setDraftText] = useState("");
  const [viewport, setViewport] = useState<"desktop" | "mobile" | "tablet">("desktop");
  const lastServerDraftFingerprintRef = useRef("");
  const autosaveRequestRef = useRef(0);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const storedDraft = readInitialShopDraft();
      setMessage(storedDraft.message);
      setLockCheckDone(!storedDraft.state.orderId);
      setResumeAccessKey(window.localStorage.getItem(ORDER_ACCESS_KEY_STORAGE_KEY) || "");
      setRecoveredDraftAvailable(storedDraft.hasStoredDraft);
      setState((current) =>
        isPristineShopBuilderState(current) ? storedDraft.state : current
      );
      setDraftRestored(true);
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (!draftRestored) return;
    if (typeof window === "undefined") return;

    const resumeParams = getResumeParamsFromUrl();
    if (!resumeParams) {
      const noResumeTimer = window.setTimeout(() => setResumeChecked(true), 0);
      return () => window.clearTimeout(noResumeTimer);
    }
    const resumeOrderId = resumeParams.orderId;
    const resumeKey = resumeParams.accessKey;

    let active = true;
    async function loadResumeLink() {
      setLockCheckDone(false);
      setMessage("Loading secure resume link...");
      try {
        const response = await fetch(
          `/api/shop/order?order=${encodeURIComponent(resumeOrderId)}&key=${encodeURIComponent(resumeKey)}`,
          { cache: "no-store" }
        );
        const payload = (await response.json().catch(() => ({}))) as { order?: PublicShopOrder | null };
        const order = payload.order || null;
        if (!active) return;

        if (!response.ok || !order || order.siteStatus === "protected" || !order.state) {
          setMessage("This resume link could not be verified. Use the same browser draft or save again.");
          return;
        }

        const resumedState = normalizeShopBuilderState(order.state);
        storeOrderAccessKey(order.accessKey || resumeKey);
        setResumeAccessKey(order.accessKey || resumeKey);
        setRecoveredDraftAvailable(true);
        setState(resumedState);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resumedState));
        setMessage("Secure resume link loaded. Continue Draft to edit this website.");

        if (
          order.lockedAt ||
          order.paymentStatus === "paid" ||
          order.paymentStatus === "published" ||
          order.siteStatus === "publishing" ||
          order.siteStatus === "published" ||
          order.siteStatus === "publish_failed"
        ) {
          setLockedOrder(order);
        }
      } catch {
        if (active) setMessage("Secure resume link could not load. Your browser draft is still safe.");
      } finally {
        if (active) {
          setResumeChecked(true);
          setLockCheckDone(true);
        }
      }
    }

    const resumeTimer = window.setTimeout(() => {
      void loadResumeLink();
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(resumeTimer);
    };
  }, [draftRestored]);

  useEffect(() => {
    if (!draftRestored) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [draftRestored, state]);

  useEffect(() => {
    const orderId = state.orderId;
    if (!draftRestored) return;
    if (!orderId) {
      const clearLockTimer = window.setTimeout(() => {
        setLockedOrder(null);
        setLockCheckDone(true);
      }, 0);

      return () => window.clearTimeout(clearLockTimer);
    }

    let active = true;
    const lockCheckTimer = window.setTimeout(() => {
      if (active) setLockCheckDone(false);
    }, 0);
    async function checkOrderLock() {
      try {
        const response = await fetch(`/api/shop/order?order=${encodeURIComponent(orderId)}`, {
          cache: "no-store",
          headers: getOrderAccessKeyHeader()
        });
        const payload = (await response.json().catch(() => ({}))) as { order?: PublicShopOrder | null };
        const order = payload.order || null;
        const locked =
          order &&
          (order.lockedAt ||
            order.paymentStatus === "paid" ||
            order.paymentStatus === "published" ||
            order.siteStatus === "publishing" ||
            order.siteStatus === "published" ||
            order.siteStatus === "publish_failed");
        if (active && locked) setLockedOrder(order);
      } finally {
        if (active) setLockCheckDone(true);
      }
    }

    void checkOrderLock();
    return () => {
      active = false;
      window.clearTimeout(lockCheckTimer);
    };
  }, [draftRestored, state.orderId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setInspectOn(false);
        setSelectedScope(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const normalizedState = useMemo(() => normalizeShopBuilderState(state), [state]);
  const hasRecoverableDraft =
    draftRestored && recoveredDraftAvailable && !isPristineShopBuilderState(normalizedState);
  const previewSite = useMemo(
    () => buildCoachSiteFromShopState({ state: normalizedState }),
    [normalizedState]
  );
  const resumeLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    if (!normalizedState.orderId || !resumeAccessKey) return "";
    const url = new URL("/shop", window.location.origin);
    url.searchParams.set("order", normalizedState.orderId);
    url.searchParams.set("key", resumeAccessKey);
    return url.toString();
  }, [normalizedState.orderId, resumeAccessKey]);
  const progressPercent = Math.round((normalizedState.currentStep / SHOP_BUILDER_STEPS.length) * 100);
  const currentIssues = validateShopBuilderState(normalizedState, {
    requirePaymentReady: normalizedState.currentStep >= 4
  });
  const draftFingerprint = useMemo(
    () => getDraftFingerprint(normalizedState),
    [normalizedState]
  );

  const patchState = useCallback((patch: Partial<ShopBuilderState>) => {
    const refreshGeneratedContent = !patch.content && shouldRefreshGeneratedShopContent(patch);
    setState((current) => {
      const nextInput = {
        ...current,
        ...patch
      };
      if (refreshGeneratedContent) {
        const previewIdentity = {
          coachName: nextInput.coachName || "",
          location: nextInput.location || "",
          niche: nextInput.niche || "",
          shortBio: nextInput.shortBio || nextInput.bio || ""
        };
        nextInput.content = createShopContent(previewIdentity);
      }
      const next = normalizeShopBuilderState(nextInput);
      return next;
    });
  }, []);

  const persistDraft = useCallback(
    async (snapshot: ShopBuilderState, mode: DraftPersistMode) => {
      if (mode === "manual") {
        setSaving(true);
        setMessage("Saving your website draft...");
      }
      if (mode === "start") {
        setMessage("Creating your secure draft...");
      }
      if (mode === "autosave") {
        setAutoSaveStatus("saving");
        setAutoSaveText("Autosaving draft...");
      }

      try {
        const response = await fetch("/api/shop/draft", {
          body: JSON.stringify({
            idempotencyKey: getStableShopIdempotencyKey(snapshot.orderId),
            state: snapshot
          }),
          cache: "no-store",
          headers: { "content-type": "application/json" },
          method: "POST"
        });
        const payload = (await response.json().catch(() => ({}))) as CheckoutResponse;
        if (!response.ok || !payload.ok) {
          const error =
            payload.error || "Draft could not be saved. Your browser draft is still preserved.";
          if (mode === "autosave") {
            setAutoSaveStatus("error");
            setAutoSaveText("Autosave failed. Use Save Draft before checkout.");
          } else {
            setMessage(error);
          }
          return false;
        }

        const savedOrderId = payload.order?.orderId || snapshot.orderId;
        const savedSlug = payload.order?.publicUrl.split("/").pop() || snapshot.slug;
        const savedState = normalizeShopBuilderState({
          ...snapshot,
          orderId: savedOrderId,
          slug: savedSlug
        });

        if (payload.order?.orderId) {
          storeOrderAccessKey(payload.accessKey);
          setResumeAccessKey(payload.accessKey || "");
          patchState({ orderId: savedState.orderId, slug: savedState.slug });
        }
        setRecoveredDraftAvailable(true);
        lastServerDraftFingerprintRef.current = getDraftFingerprint(savedState);
        setAutoSaveStatus("saved");
        setAutoSaveText(`Draft saved ${formatClockTime(new Date())}.`);

        if (mode === "manual") {
          setMessage("Draft saved. You can continue safely.");
        } else if (mode === "start") {
          setMessage("Secure draft created. Continue building.");
        }

        return true;
      } catch {
        if (mode === "autosave") {
          setAutoSaveStatus("error");
          setAutoSaveText("Autosave could not connect. Use Save Draft before checkout.");
        } else {
          setMessage("Network issue while saving. Your browser draft is still preserved.");
        }
        return false;
      } finally {
        if (mode === "manual") setSaving(false);
      }
    },
    [patchState]
  );

  useEffect(() => {
    if (!draftRestored || !builderStarted || lockedOrder || checkoutBusy || saving || startingBuilder) {
      return;
    }
    if (!canCreateRecoverableShopDraft(normalizedState)) return;
    if (draftFingerprint === lastServerDraftFingerprintRef.current) return;

    const requestId = autosaveRequestRef.current + 1;
    autosaveRequestRef.current = requestId;
    const delayMs = normalizedState.orderId ? 1400 : 450;
    const timer = window.setTimeout(() => {
      if (autosaveRequestRef.current !== requestId) return;
      void persistDraft(normalizedState, "autosave");
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [
    builderStarted,
    checkoutBusy,
    draftFingerprint,
    draftRestored,
    lockedOrder,
    normalizedState,
    persistDraft,
    saving,
    startingBuilder
  ]);

  function patchContent(patch: Partial<ShopBuilderState["content"]>) {
    setState((current) =>
      normalizeShopBuilderState({
        ...current,
        content: {
          ...current.content,
          ...patch
        }
      })
    );
  }

  function regenerateContent() {
    const content = createShopContent({
      coachName: normalizedState.coachName,
      location: normalizedState.location,
      niche: normalizedState.niche,
      shortBio: normalizedState.shortBio
    });
    patchState({ content });
    setMessage("Premium copy refreshed from your current coach details.");
  }

  async function startBuilder() {
    const entryIssues = getEntryValidationIssues(normalizedState);
    if (entryIssues.length > 0) {
      setIssues(entryIssues);
      setMessage("Add your coach name and a valid email so we can save and recover this draft.");
      return;
    }

    setIssues([]);
    setStartingBuilder(true);
    const saved = await persistDraft(normalizedState, "start");
    setStartingBuilder(false);
    if (!saved) return;

    setBuilderStarted(true);
    setMessage(
      hasRecoverableDraft
        ? "Draft resumed. Review before checkout."
        : "Builder started. Your secure draft is saved and will keep updating while you edit."
    );
  }

  function startFreshBuilder() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY);
      window.localStorage.removeItem(ORDER_ACCESS_KEY_STORAGE_KEY);
    }
    setIssues([]);
    setLockedOrder(null);
    setResumeAccessKey("");
    setAutoSaveStatus("idle");
    setAutoSaveText("");
    lastServerDraftFingerprintRef.current = "";
    setRecoveredDraftAvailable(false);
    setState(EMPTY_SHOP_BUILDER_STATE);
    setBuilderStarted(true);
    setMessage("Starting a new blank website.");
  }

  function nextStep() {
    const stepIssues = getStepIssues(normalizedState.currentStep, currentIssues);
    if (stepIssues.length) {
      setIssues(stepIssues);
      setMessage("Please fix the highlighted details before continuing.");
      return;
    }
    setIssues([]);
    if (normalizedState.currentStep === 3) {
      setInspectOn(false);
      setSelectedScope(null);
    }
    patchState({ currentStep: Math.min(SHOP_BUILDER_STEPS.length, normalizedState.currentStep + 1) });
  }

  function previousStep() {
    setIssues([]);
    patchState({ currentStep: Math.max(1, normalizedState.currentStep - 1) });
  }

  async function saveDraft() {
    await persistDraft(normalizedState, "manual");
  }

  async function buyAndPublish() {
    const paymentIssues = validateShopBuilderState(normalizedState, { requirePaymentReady: true }).filter(
      (issue) => issue.severity === "error"
    );
    if (paymentIssues.length) {
      setIssues(paymentIssues);
      setMessage("Fix the required details before secure checkout.");
      return;
    }

    setCheckoutBusy(true);
    setMessage("Preparing secure checkout...");
    try {
      const response = await fetch("/api/shop/checkout", {
        body: JSON.stringify({
          idempotencyKey: getStableShopIdempotencyKey(normalizedState.orderId),
          state: normalizedState
        }),
        cache: "no-store",
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as CheckoutResponse;
      if (!response.ok || !payload.ok || !payload.redirectUrl) {
        setIssues(payload.issues || []);
        setMessage(payload.error || "Shop payment is temporarily unavailable.");
        return;
      }
      if (payload.order?.orderId) {
        storeOrderAccessKey(payload.accessKey);
        setResumeAccessKey(payload.accessKey || "");
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            ...normalizedState,
            orderId: payload.order.orderId,
            slug: payload.order.publicUrl.split("/").pop() || normalizedState.slug,
            status: "pending_payment"
          })
        );
      }
      window.location.assign(payload.redirectUrl);
    } catch {
      setMessage("Checkout could not start. Your website draft is still saved in this browser.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function copyResumeLink() {
    if (!resumeLink) return;

    try {
      await navigator.clipboard.writeText(resumeLink);
      setMessage("Secure resume link copied. Keep it private.");
    } catch {
      setMessage("Could not copy automatically. Select and copy the secure resume link.");
    }
  }

  function selectInspectScope(target: CoachTemplatePreviewInspectTarget) {
    const scope = getInspectSectionFromTarget(target);
    setBuilderStarted(true);
    setInspectOn(true);
    setSelectedScope(scope);
    setDraftText(getScopeText(scope, normalizedState));
    if (normalizedState.currentStep !== 3) {
      patchState({ currentStep: 3 });
    }
  }

  function applyInspectEdit() {
    if (!selectedScope) return;
    const value = draftText.trim();
    if (!value) {
      setMessage("Selected content cannot be empty.");
      return;
    }
    patchContent(getScopePatch(selectedScope, value, normalizedState));
    setMessage(`${getScopeLabel(selectedScope)} updated in the live preview. Save Draft to persist.`);
  }

  function regenerateSelectedScope() {
    if (!selectedScope) return;
    const fresh = createShopContent({
      coachName: normalizedState.coachName,
      location: normalizedState.location,
      niche: normalizedState.niche,
      shortBio: normalizedState.shortBio
    });
    patchContent(getScopePatch(selectedScope, getScopeText(selectedScope, { ...normalizedState, content: fresh }), normalizedState));
    setDraftText(getScopeText(selectedScope, { ...normalizedState, content: fresh }));
    setMessage(`${getScopeLabel(selectedScope)} regenerated without changing other sections.`);
  }

  if (!draftRestored || !resumeChecked || !lockCheckDone) {
    return (
      <main className={styles.shopPage} data-shop-builder>
        <section className={styles.shell}>
          <div className={styles.workspace}>
            <div className={styles.panel}>
              <div className={styles.reviewWarning}>
                <strong>Checking your website status...</strong>
                <span>We are making sure your builder is safe to continue.</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (lockedOrder) {
    const published = lockedOrder.siteStatus === "published";
    return (
      <main className={styles.shopPage} data-shop-builder>
        <section className={styles.shell}>
          <div className={styles.workspace}>
            <div className={styles.topbar}>
              <div>
                <h1>{published ? "Your website is already published" : "Your website is in publishing"}</h1>
                <p>
                  Your website is already published. For future changes, please contact YWcoach
                  support.
                </p>
              </div>
            </div>
            <div className={styles.panel}>
              <div className={published ? styles.successCard : styles.reviewWarning}>
                <strong>{published ? `Congratulations, Coach ${lockedOrder.coachName || normalizedState.coachName || "Coach"}!` : "Publishing workflow is protected."}</strong>
                <span>
                  Coach-facing editing is locked after payment verification so your public website
                  stays stable.
                </span>
                <code>{lockedOrder.publicUrl || `/coach/${normalizedState.slug || "coach"}`}</code>
              </div>
              <div className={styles.stepActions}>
                {published && lockedOrder.publicUrl ? (
                  <a className={styles.buyButton} href={lockedOrder.publicUrl} rel="noreferrer" target="_blank">
                    Open Website
                  </a>
                ) : (
                  <a className={styles.buyButton} href={`/shop/success?order=${encodeURIComponent(lockedOrder.orderId)}`}>
                    Check Publish Status
                  </a>
                )}
                <button
                  onClick={() => {
                    window.localStorage.removeItem(STORAGE_KEY);
                    window.localStorage.removeItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY);
                    window.localStorage.removeItem(ORDER_ACCESS_KEY_STORAGE_KEY);
                    window.location.assign("/shop");
                  }}
                  type="button"
                >
                  Start New Website
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!builderStarted) {
    return (
      <main className={styles.shopPage} data-shop-builder>
        <section className={`${styles.shell} ${styles.entryShell}`}>
          <div className={styles.entryPanel}>
            <div className={styles.brandLockup}>
              <span>YW</span>
              <div>
                <strong>YWcoach Shop</strong>
                <small>Build, save, preview, and publish your coach website</small>
              </div>
            </div>
            <div>
              <h1>Start your coach website</h1>
              <p>
                Begin with your coach identity, resume a saved draft, and preview the exact
                website before secure checkout.
              </p>
            </div>
            {message ? <p className={styles.statusLine}>{message}</p> : null}
            {issues.length > 0 ? (
              <div className={styles.issueList} role="alert">
                <strong>Required before builder</strong>
                {issues.map((issue) => (
                  <span key={`${issue.field}-${issue.message}`}>{issue.message}</span>
                ))}
              </div>
            ) : null}
            {hasRecoverableDraft ? (
              <div className={styles.draftResumeCard}>
                <strong>Saved draft found</strong>
                <span>{normalizedState.coachName || "Unnamed coach website"}</span>
                <code>/coach/{normalizedState.slug || "coach-slug"}</code>
                {resumeLink ? (
                  <>
                    <small>Secure resume link</small>
                    <code>{resumeLink}</code>
                  </>
                ) : null}
              </div>
            ) : null}
            <div className={styles.entryGrid}>
              <Field
                label="Coach name"
                onChange={(coachName) => patchState({ coachName })}
                placeholder="Your public coach name"
                value={normalizedState.coachName}
              />
              <Field
                label="Niche"
                onChange={(niche) => patchState({ niche })}
                placeholder="Hormone wellness, fitness, nutrition..."
                value={normalizedState.niche}
              />
              <Field
                label="Email"
                onChange={(email) => patchState({ email, coachEmail: email })}
                placeholder="name@example.com"
                value={normalizedState.email}
              />
            </div>
            <div className={styles.entryActions}>
              <button
                className={styles.buyButton}
                disabled={startingBuilder}
                onClick={() => void startBuilder()}
                type="button"
              >
                {startingBuilder
                  ? "Saving Draft..."
                  : hasRecoverableDraft
                    ? "Continue Draft"
                    : "Start Builder"}
              </button>
              {hasRecoverableDraft ? (
                <button onClick={startFreshBuilder} type="button">
                  Start Fresh
                </button>
              ) : null}
            </div>
            <p className={styles.previewHint}>
              We create a secure server draft before the builder opens. Your browser also keeps a
              local recovery copy.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shopPage} data-shop-builder>
      <section className={styles.shell}>
        <aside className={styles.rail} aria-label="Shop builder progress">
          <div className={styles.brandLockup}>
            <span>YW</span>
            <div>
              <strong>YWcoach Shop</strong>
              <small>Premium website builder</small>
            </div>
          </div>
          <div className={styles.progressPanel}>
            <span>Step {normalizedState.currentStep} of {SHOP_BUILDER_STEPS.length}</span>
            <strong>{progressPercent}% ready</strong>
            <div className={styles.progressTrack}>
              <i style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          <ol className={styles.stepList}>
            {SHOP_BUILDER_STEPS.map((step, index) => (
              <li
                data-active={normalizedState.currentStep === index + 1 ? "true" : undefined}
                data-complete={normalizedState.currentStep > index + 1 ? "true" : undefined}
                key={step}
              >
                <span>{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          <div className={styles.lockNote}>
            <strong>Review carefully before payment.</strong>
            <p>
              Once published, future edits are handled through YWcoach support so the public site
              stays stable.
            </p>
          </div>
        </aside>

        <section className={styles.workspace}>
          <div className={styles.topbar}>
            <div>
              <h1>Create your premium coach website</h1>
              <p>Build, preview, edit, and purchase a YW Nutritech-ready public website.</p>
            </div>
            <div className={styles.topbarActions}>
              <button disabled={saving} onClick={() => void saveDraft()} type="button">
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button disabled={checkoutBusy} onClick={() => void buyAndPublish()} type="button">
                {checkoutBusy ? "Preparing..." : "Buy & Publish"}
              </button>
            </div>
          </div>

          {message ? <p className={styles.statusLine}>{message}</p> : null}
          <p className={styles.autoSaveLine} data-state={autoSaveStatus}>
            {autoSaveText ||
              (normalizedState.orderId
                ? "Secure server draft is ready."
                : "Enter name and email to enable secure draft recovery.")}
          </p>
          {resumeLink && !lockedOrder ? (
            <div className={styles.resumeLinkCard}>
              <div>
                <strong>Secure resume link</strong>
                <span>Use this private link to continue this draft on another browser or device.</span>
                <code>{resumeLink}</code>
              </div>
              <button onClick={() => void copyResumeLink()} type="button">
                Copy Resume Link
              </button>
            </div>
          ) : null}
          {issues.length > 0 ? (
            <div className={styles.issueList} role="alert">
              <strong>Fix before continuing</strong>
              {issues.map((issue) => (
                <span key={`${issue.field}-${issue.message}`}>{issue.message}</span>
              ))}
            </div>
          ) : null}

          <div className={styles.contentGrid}>
            <section className={styles.panel}>
              {normalizedState.currentStep === 1 ? (
                <CoachDetailsStep state={normalizedState} onPatch={patchState} onRegenerate={regenerateContent} />
              ) : null}
              {normalizedState.currentStep === 2 ? (
                <MediaContactStep state={normalizedState} onPatch={patchState} />
              ) : null}
              {normalizedState.currentStep === 3 ? (
                <PreviewEditStep
                  draftText={draftText}
                  inspectOn={inspectOn}
                  onApply={applyInspectEdit}
                  onDraftText={setDraftText}
                  onRegenerate={regenerateSelectedScope}
                  onSelectedScope={setSelectedScope}
                  onToggleInspect={() => setInspectOn((value) => !value)}
                  selectedScope={selectedScope}
                  state={normalizedState}
                  viewport={viewport}
                  onViewport={setViewport}
                />
              ) : null}
              {normalizedState.currentStep === 4 ? (
                <PaymentStep issues={currentIssues} onBuy={() => void buyAndPublish()} state={normalizedState} busy={checkoutBusy} />
              ) : null}
              {normalizedState.currentStep === 5 ? <SuccessPreview state={normalizedState} /> : null}

              <div className={styles.stepActions}>
                <button disabled={normalizedState.currentStep === 1} onClick={previousStep} type="button">
                  Back
                </button>
                {normalizedState.currentStep < 4 ? (
                  <button onClick={nextStep} type="button">Next</button>
                ) : normalizedState.currentStep === 4 ? (
                  <button disabled={checkoutBusy} onClick={() => void buyAndPublish()} type="button">
                    {checkoutBusy ? "Preparing checkout..." : "Buy & Publish"}
                  </button>
                ) : null}
              </div>
            </section>

            <section className={styles.previewColumn} aria-label="Live website preview">
              <div className={styles.previewFrame} data-size={viewport}>
                <div className={styles.previewToolbar}>
                  <span>Live preview</span>
                  <div>
                    {(["desktop", "tablet", "mobile"] as const).map((item) => (
                      <button
                        data-active={viewport === item ? "true" : undefined}
                        key={item}
                        onClick={() => setViewport(item)}
                        type="button"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.previewCanvas}>
                  <PublicCoachSitePage
                    enableTracking={false}
                    inspectMode={inspectOn}
                    onSelectInspectScope={selectInspectScope}
                    previewMode
                    selectedInspectScope={selectedScope}
                    site={previewSite}
                    stickyMode="contained"
                  />
                  <div className={styles.inspectWidget} data-active={inspectOn ? "true" : undefined}>
                    <button onClick={() => setInspectOn((value) => !value)} type="button">
                      <span aria-hidden="true">+</span>
                      {inspectOn ? "Inspect On" : "Inspect"}
                    </button>
                    {inspectOn ? <small>Click highlighted preview sections to edit.</small> : null}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}

function CoachDetailsStep({
  onPatch,
  onRegenerate,
  state
}: {
  onPatch: (patch: Partial<ShopBuilderState>) => void;
  onRegenerate: () => void;
  state: ShopBuilderState;
}) {
  return (
    <div className={styles.stepPanel}>
      <span className={styles.stepEyebrow}>Step 1</span>
      <h2>Tell us about your coaching work</h2>
      <p>Use simple, client-friendly language. The preview updates as you type.</p>
      <Field label="Coach name" value={state.coachName} onChange={(coachName) => onPatch({ coachName })} />
      <Field label="Niche" value={state.niche} onChange={(niche) => onPatch({ niche })} placeholder="Hormone wellness, fitness, nutrition..." />
      <Field label="Location" value={state.location} onChange={(location) => onPatch({ location })} />
      <Field
        label="Short bio"
        value={state.shortBio}
        onChange={(shortBio) => onPatch({ shortBio, bio: shortBio })}
        textarea
      />
      <button className={styles.secondaryButton} onClick={onRegenerate} type="button">
        Improve website copy
      </button>
    </div>
  );
}

function MediaContactStep({
  onPatch,
  state
}: {
  onPatch: (patch: Partial<ShopBuilderState>) => void;
  state: ShopBuilderState;
}) {
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadingMediaType, setUploadingMediaType] = useState<"" | "image" | "video">("");
  const imagePreviewUrl = state.photoUrl || state.logoUrl;
  const videoEmbedUrl = normalizeVideoEmbedUrl(state.videoUrl);
  const uploadedVideoUrl = isUploadedVideoSource(state.videoUrl) ? state.videoUrl : "";
  const videoInvalid =
    state.heroMediaType === "video" && state.videoUrl.trim() && !videoEmbedUrl && !uploadedVideoUrl;

  async function handleMediaUpload(file: File | undefined, mediaType: "image" | "video") {
    if (!file) return;

    const maxBytes = mediaType === "image" ? SHOP_PHOTO_MAX_BYTES : SHOP_VIDEO_MAX_BYTES;
    if (file.size > maxBytes) {
      setUploadMessage(
        mediaType === "image"
          ? "Photo is too large. Upload a photo under 12 MB or use a secure HTTPS image link."
          : "Video is too large. Upload a video under 24 MB or use a secure video link."
      );
      return;
    }

    if (mediaType === "image" && !isAllowedShopPhotoFile(file)) {
      setUploadMessage("Upload JPEG, PNG, WebP, AVIF, GIF, HEIC, HEIF, BMP, or TIFF.");
      return;
    }

    if (mediaType === "video" && !isAllowedShopVideoFile(file)) {
      setUploadMessage("Upload an MP4, MOV, or WebM video file.");
      return;
    }

    const previousUrl = mediaType === "image" ? state.photoUrl : state.videoUrl;
    setUploadingMediaType(mediaType);
    setUploadMessage(
      mediaType === "image"
        ? `Removing background from ${file.name}...`
        : `Uploading ${file.name} securely...`
    );

    const preparedMedia =
      mediaType === "image"
        ? await prepareCoachHeroPhotoForUpload(file, {
            maxBytes: SHOP_PHOTO_MAX_BYTES,
            maxEdge: SHOP_PHOTO_PROCESS_MAX_EDGE
          }).catch(() => ({
            backgroundRemoved: false,
            file,
            message: "Could not remove the background in this browser. Uploading the original photo.",
            optimized: false
          }))
        : { backgroundRemoved: false, file, message: "", optimized: false };
    const uploadFile = preparedMedia.file;

    if (mediaType === "image" && uploadFile.size > SHOP_PHOTO_MAX_BYTES) {
      setUploadingMediaType("");
      setUploadMessage(
        "Photo is still too large after background removal. Use a smaller image or a secure HTTPS image link."
      );
      return;
    }

    const previewUrl = URL.createObjectURL(uploadFile);

    onPatch(
      mediaType === "image"
        ? { heroMediaType: "image", photoUrl: previewUrl }
        : { heroMediaType: "video", videoUrl: previewUrl }
    );
    setUploadMessage(
      preparedMedia.message
        ? `${preparedMedia.message} Uploading...`
        : `Uploading ${uploadFile.name} securely...`
    );

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("mediaType", mediaType);
      formData.append("slug", state.slug || state.coachName || "shop-draft");

      const response = await fetch("/api/shop/media", {
        body: formData,
        cache: "no-store",
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as MediaUploadResponse;

      if (!response.ok || !payload.ok || !payload.media?.publicUrl) {
        onPatch(mediaType === "image" ? { photoUrl: previousUrl } : { videoUrl: previousUrl });
        setUploadMessage(
          payload.error || "Media upload was unavailable. Use a secure HTTPS media link instead."
        );
        return;
      }

      onPatch(
        mediaType === "image"
          ? { heroMediaType: "image", photoUrl: payload.media.publicUrl }
          : { heroMediaType: "video", videoUrl: payload.media.publicUrl }
      );
      setUploadMessage(
        mediaType === "image"
          ? `${uploadFile.name} uploaded as transparent hero PNG (${formatBytes(uploadFile.size)}).`
          : `${uploadFile.name} uploaded and saved securely (${formatBytes(uploadFile.size)}).`
      );
    } catch {
      onPatch(mediaType === "image" ? { photoUrl: previousUrl } : { videoUrl: previousUrl });
      setUploadMessage("Media upload could not connect. Use a secure HTTPS media link instead.");
    } finally {
      URL.revokeObjectURL(previewUrl);
      setUploadingMediaType("");
    }
  }

  return (
    <div className={styles.stepPanel}>
      <span className={styles.stepEyebrow}>Step 2</span>
      <h2>Add media and client contact</h2>
      <p>Upload a coach photo or video, or paste a secure media link. The public preview updates after the file is saved.</p>
      <div className={styles.mediaTypeToggle} aria-label="Hero media type">
        {(["image", "video", "none"] as const).map((mediaType) => (
          <button
            data-active={state.heroMediaType === mediaType ? "true" : undefined}
            key={mediaType}
            onClick={() => onPatch({ heroMediaType: mediaType })}
            type="button"
          >
            {mediaType === "image" ? "Photo" : mediaType === "video" ? "Video" : "Text only"}
          </button>
        ))}
      </div>

      {state.heroMediaType === "image" ? (
        <div className={styles.mediaUploadGrid}>
          <label className={styles.uploadField}>
            <span>Upload coach photo/logo</span>
            <input
              accept={PHOTO_UPLOAD_ACCEPT}
              disabled={uploadingMediaType === "image"}
              onChange={(event) => void handleMediaUpload(event.target.files?.[0], "image")}
              type="file"
            />
            <small>
              {uploadingMediaType === "image"
                ? "Uploading photo securely..."
                : "JPEG, PNG, WebP, AVIF, GIF, HEIC, HEIF, BMP, and TIFF are supported."}
            </small>
          </label>
          <Field label="Photo/logo URL" value={state.photoUrl} onChange={(photoUrl) => onPatch({ photoUrl })} placeholder="https://..." />
          <div className={styles.mediaPreview} data-state={imagePreviewUrl ? "ready" : "empty"}>
            {imagePreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="Uploaded coach media preview" src={imagePreviewUrl} />
            ) : (
              <span>Photo preview</span>
            )}
          </div>
          {imagePreviewUrl ? (
            <button className={styles.secondaryButton} onClick={() => onPatch({ photoUrl: "" })} type="button">
              Remove Photo
            </button>
          ) : null}
        </div>
      ) : null}

      {state.heroMediaType === "video" ? (
        <div className={styles.mediaUploadGrid}>
          <label className={styles.uploadField}>
            <span>Upload coach video</span>
            <input
              accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
              disabled={uploadingMediaType === "video"}
              onChange={(event) => void handleMediaUpload(event.target.files?.[0], "video")}
              type="file"
            />
            <small>
              {uploadingMediaType === "video"
                ? "Uploading video securely..."
                : "MP4, MOV, and WebM are supported. YouTube links also work."}
            </small>
          </label>
          <Field label="Optional video URL" value={state.videoUrl} onChange={(videoUrl) => onPatch({ videoUrl })} placeholder="https://..." />
          <div className={styles.mediaPreview} data-state={videoEmbedUrl || uploadedVideoUrl ? "ready" : "empty"}>
            {videoEmbedUrl ? (
              <iframe
                allow="accelerometer; autoplay; clipboard-write; compute-pressure; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                src={videoEmbedUrl}
                title="Coach video preview"
              />
            ) : uploadedVideoUrl ? (
              <video controls src={uploadedVideoUrl} />
            ) : (
              <span>Video preview</span>
            )}
          </div>
          {videoInvalid ? (
            <p className={styles.issueList}>Add a supported video upload, YouTube link, or choose Text only.</p>
          ) : null}
          {state.videoUrl ? (
            <button className={styles.secondaryButton} onClick={() => onPatch({ videoUrl: "" })} type="button">
              Remove Video
            </button>
          ) : null}
        </div>
      ) : null}

      {state.heroMediaType === "none" ? (
        <div className={styles.emptyEditor}>Text-only hero selected. No media will appear on the public website.</div>
      ) : null}

      {uploadMessage ? <p className={styles.statusLine}>{uploadMessage}</p> : null}
      <Field label="Email" value={state.email} onChange={(email) => onPatch({ email, coachEmail: email })} />
      <Field label="Phone/WhatsApp" value={state.coachPhone} onChange={(coachPhone) => onPatch({ coachPhone })} />
      <Field label="Registration/contact link" value={state.contactLink} onChange={(contactLink) => onPatch({ contactLink })} placeholder="https://forms.gle/... or https://wa.me/..." />
    </div>
  );
}

function PreviewEditStep({
  draftText,
  inspectOn,
  onApply,
  onDraftText,
  onRegenerate,
  onSelectedScope,
  onToggleInspect,
  selectedScope,
  state,
  viewport,
  onViewport
}: {
  draftText: string;
  inspectOn: boolean;
  onApply: () => void;
  onDraftText: (value: string) => void;
  onRegenerate: () => void;
  onSelectedScope: (scope: CoachTemplatePreviewInspectSection | null) => void;
  onToggleInspect: () => void;
  selectedScope: CoachTemplatePreviewInspectSection | null;
  state: ShopBuilderState;
  viewport: "desktop" | "mobile" | "tablet";
  onViewport: (value: "desktop" | "mobile" | "tablet") => void;
}) {
  return (
    <div className={styles.stepPanel}>
      <span className={styles.stepEyebrow}>Step 3</span>
      <h2>Edit directly on the preview</h2>
      <p>Turn Inspect on, click a visible section, then edit or regenerate only that section.</p>
      <div className={styles.inlineActions}>
        <button data-active={inspectOn ? "true" : undefined} onClick={onToggleInspect} type="button">
          {inspectOn ? "Inspect On" : "Turn Inspect On"}
        </button>
        {(["desktop", "tablet", "mobile"] as const).map((item) => (
          <button data-active={viewport === item ? "true" : undefined} key={item} onClick={() => onViewport(item)} type="button">
            {item}
          </button>
        ))}
      </div>
      {selectedScope ? (
        <div className={styles.annotationEditor}>
          <span>{getScopeLabel(selectedScope)}</span>
          <textarea value={draftText} onChange={(event) => onDraftText(event.target.value)} />
          <div>
            <button onClick={onApply} type="button">Apply</button>
            <button onClick={onRegenerate} type="button">Regenerate this section</button>
            <button onClick={() => onSelectedScope(null)} type="button">Cancel</button>
          </div>
        </div>
      ) : (
        <div className={styles.emptyEditor}>
          {inspectOn ? "Click a highlighted section in the live preview." : "Inspect mode is off."}
        </div>
      )}
      <div className={styles.reviewWarning}>
        Please review your website carefully. Once your website is published, you will not be able
        to make edits yourself. Any future changes must be requested through YWcoach support.
      </div>
      <small className={styles.previewHint}>Current headline: {state.content.heroHeadline}</small>
    </div>
  );
}

function PaymentStep({
  busy,
  issues,
  onBuy,
  state
}: {
  busy: boolean;
  issues: ShopValidationIssue[];
  onBuy: () => void;
  state: ShopBuilderState;
}) {
  return (
    <div className={styles.stepPanel}>
      <span className={styles.stepEyebrow}>Step 4</span>
      <h2>Review and secure checkout</h2>
      <p>Your site is saved as pending payment first. It publishes only after server-side payment verification is connected and confirmed.</p>
      <dl className={styles.summaryList}>
        <div><dt>Coach</dt><dd>{state.coachName || "Missing"}</dd></div>
        <div><dt>Niche</dt><dd>{state.niche || "Missing"}</dd></div>
        <div><dt>Public URL</dt><dd>/coach/{state.slug || "coach-slug"}</dd></div>
      </dl>
      {issues.length > 0 ? (
        <div className={styles.issueList}>
          {issues.map((issue) => <span key={issue.message}>{issue.message}</span>)}
        </div>
      ) : null}
      <div className={styles.reviewWarning}>
        Please review your website carefully. Once your website is published, you will not be able
        to make edits yourself. Any future changes must be requested through YWcoach support.
      </div>
      <button className={styles.buyButton} disabled={busy} onClick={onBuy} type="button">
        {busy ? "Preparing secure checkout..." : "Buy & Publish"}
      </button>
    </div>
  );
}

function SuccessPreview({ state }: { state: ShopBuilderState }) {
  return (
    <div className={styles.stepPanel}>
      <span className={styles.stepEyebrow}>Step 5</span>
      <h2>Congratulations preview</h2>
      <p>After verified payment and publishing, the success page will show your live website link.</p>
      <div className={styles.successCard}>
        <strong>Congratulations, Coach {state.coachName || "Coach"}!</strong>
        <span>Your premium coach website has been published.</span>
        <code>/coach/{state.slug || "coach-slug"}</code>
      </div>
    </div>
  );
}

function Field({
  label,
  onChange,
  placeholder,
  textarea,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  textarea?: boolean;
  value: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      )}
    </label>
  );
}

function isAllowedShopPhotoFile(file: File) {
  const contentType = file.type.trim().toLowerCase();
  const extension = getClientFileExtension(file.name);
  if (contentType === "image/svg+xml") return false;
  if (ALLOWED_PHOTO_TYPES.has(contentType)) return true;
  return Boolean(
    extension &&
      ALLOWED_PHOTO_EXTENSIONS.has(extension) &&
      (contentType === "" || contentType === "application/octet-stream")
  );
}

function isAllowedShopVideoFile(file: File) {
  const contentType = file.type.trim().toLowerCase();
  const extension = getClientFileExtension(file.name);
  if (["video/mp4", "video/quicktime", "video/webm"].includes(contentType)) return true;
  return Boolean(
    extension &&
      [".mp4", ".mov", ".webm"].includes(extension) &&
      (contentType === "" || contentType === "application/octet-stream")
  );
}

function getClientFileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] || "";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function getOrderAccessKeyHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const accessKey = window.localStorage.getItem(ORDER_ACCESS_KEY_STORAGE_KEY) || "";
  return accessKey ? { "x-shop-access-key": accessKey } : {};
}

function storeOrderAccessKey(accessKey?: string) {
  if (typeof window === "undefined" || !accessKey) return;
  window.localStorage.setItem(ORDER_ACCESS_KEY_STORAGE_KEY, accessKey);
}

function getResumeParamsFromUrl() {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("order")?.trim() || "";
  const accessKey = params.get("key")?.trim() || "";
  if (!orderId || !accessKey) return null;

  return { accessKey, orderId };
}

function getDraftFingerprint(state: ShopBuilderState) {
  return JSON.stringify(normalizeShopBuilderState(state));
}

function canCreateRecoverableShopDraft(state: ShopBuilderState) {
  return Boolean(state.coachName.trim() && isValidShopEmail(state.email || state.coachEmail));
}

function getEntryValidationIssues(state: ShopBuilderState): ShopValidationIssue[] {
  const issues: ShopValidationIssue[] = [];
  if (!state.coachName.trim()) {
    issues.push({ field: "coachName", message: "Coach name is required before saving a draft.", severity: "error" });
  }
  if (!isValidShopEmail(state.email || state.coachEmail)) {
    issues.push({ field: "email", message: "Enter a valid email to recover this draft later.", severity: "error" });
  }
  return issues;
}

function isValidShopEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

function formatClockTime(value: Date) {
  return value.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getStepIssues(step: number, issues: ShopValidationIssue[]) {
  const stepFields: Record<number, Array<ShopValidationIssue["field"]>> = {
    1: ["coachName", "niche", "shortBio"],
    2: ["email", "contactLink"],
    3: ["content", "preview"],
    4: ["payment"]
  };
  return issues.filter((issue) => stepFields[step]?.includes(issue.field));
}

function getInspectSectionFromTarget(
  target: CoachTemplatePreviewInspectTarget
): CoachTemplatePreviewInspectSection {
  const section = String(target).split(".")[0];
  if (
    section === "benefits" ||
    section === "bonus" ||
    section === "cta" ||
    section === "faq" ||
    section === "footer" ||
    section === "hero" ||
    section === "intro" ||
    section === "journey" ||
    section === "media" ||
    section === "problem" ||
    section === "vision"
  ) {
    return section;
  }

  if (section === "coach" || section === "brand" || section === "stickyCta") return "hero";
  if (section === "support") return "footer";
  return "hero";
}

function getScopeLabel(scope: CoachTemplatePreviewInspectSection) {
  return {
    benefits: "Benefits",
    bonus: "Bonus",
    cta: "CTA",
    faq: "FAQ",
    footer: "Footer",
    hero: "Hero",
    intro: "Coach Intro",
    journey: "Journey",
    media: "Media",
    problem: "Problem",
    vision: "Mission"
  }[scope];
}

function getScopeText(scope: CoachTemplatePreviewInspectSection, state: ShopBuilderState) {
  const content = state.content;
  if (scope === "hero") return content.heroHeadline;
  if (scope === "intro") return content.coachIntro;
  if (scope === "vision") return content.visionText;
  if (scope === "problem") return content.problemHeading;
  if (scope === "journey") return content.journeyHeading;
  if (scope === "bonus") return content.benefitsHeading;
  if (scope === "benefits") return content.benefits[0] || content.benefitsHeading;
  if (scope === "media") return content.mediaHeading;
  if (scope === "cta") return content.ctaText;
  if (scope === "faq") return content.faq[0]?.question || content.faqHeading;
  return content.footerBrandLine;
}

function getScopePatch(
  scope: CoachTemplatePreviewInspectSection,
  value: string,
  state: ShopBuilderState
): Partial<ShopBuilderState["content"]> {
  if (scope === "hero") return { heroHeadline: value };
  if (scope === "intro") return { coachIntro: value };
  if (scope === "vision") return { visionText: value };
  if (scope === "problem") return { problemHeading: value };
  if (scope === "journey") return { journeyHeading: value };
  if (scope === "bonus") return { benefitsHeading: value };
  if (scope === "benefits") return { benefits: [value, ...state.content.benefits.slice(1)] };
  if (scope === "media") return { mediaHeading: value };
  if (scope === "cta") return { ctaText: value };
  if (scope === "faq") {
    return {
      faq: [{ ...(state.content.faq[0] || { answer: "", question: "" }), question: value }, ...state.content.faq.slice(1)]
    };
  }
  return { footerBrandLine: value };
}
