"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";

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
import {
  prepareCoachHeroPhotoForUpload,
  preloadCoachHeroPhotoBackgroundRemoval
} from "../../lib/client/coach-photo-background-removal";
import { coachTemplateThemes, type CoachTemplateThemeId } from "../../lib/coach-template-themes";
import { isUploadedVideoSource, normalizeVideoEmbedUrl } from "../../lib/video-links";
import styles from "./shop-builder.module.css";

const STORAGE_KEY = "ywcoach-shop-builder-draft-v1";
const CHECKOUT_IDEMPOTENCY_STORAGE_KEY = "ywcoach-shop-checkout-idempotency-v1";
const ORDER_ACCESS_KEY_STORAGE_KEY = "ywcoach-shop-order-access-key-v1";
const SHOP_PHOTO_MAX_BYTES = 12 * 1024 * 1024;
const SHOP_VIDEO_MAX_BYTES = 70 * 1024 * 1024;
const PHOTO_UPLOAD_ACCEPT =
  ".jpg,.jpeg,.jpe,.jfif,.png,.webp,.avif,.gif,.heic,.heif,.bmp,.tif,.tiff,image/jpeg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif,image/bmp,image/tiff";
const VIDEO_UPLOAD_ACCEPT =
  ".mp4,.m4v,.mov,.webm,.ogv,.ogg,.3gp,.3g2,.mpeg,.mpg,.avi,.wmv,.mkv,video/mp4,application/mp4,video/x-m4v,video/quicktime,video/webm,video/ogg,application/ogg,video/3gpp,video/3gpp2,video/mpeg,video/x-msvideo,video/msvideo,video/x-ms-wmv,video/x-matroska";
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
const ALLOWED_VIDEO_EXTENSIONS = new Set([
  ".3g2",
  ".3gp",
  ".avi",
  ".m4v",
  ".mkv",
  ".mov",
  ".mp4",
  ".mpeg",
  ".mpg",
  ".ogg",
  ".ogv",
  ".webm",
  ".wmv"
]);
const ALLOWED_VIDEO_TYPES = new Set([
  "application/mp4",
  "application/ogg",
  "video/3gpp",
  "video/3gpp2",
  "video/mp4",
  "video/mpeg",
  "video/msvideo",
  "video/ogg",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "video/x-matroska",
  "video/x-ms-wmv",
  "video/x-msvideo"
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
    cutoutUrl?: string;
    fallbackMode?: "cutout" | "framed" | "original";
    mediaType: "image" | "video";
    objectKey: string;
    originalObjectKey?: string;
    originalUrl?: string;
    processingAttemptErrorCodes?: string[];
    processingErrorCode?: string;
    processingProvider?: "already-transparent" | "photoroom" | "removebg";
    processingStatus?: "cutout_ready" | "disabled" | "framed_fallback" | "not_configured";
    publicUrl: string;
    qualityStatus?: "failed" | "passed" | "skipped";
    safeMessage?: string;
    sizeBytes: number;
  };
  ok?: boolean;
};

type CoachImageMediaResult = NonNullable<MediaUploadResponse["media"]>;

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
  const [mediaProcessingMessage, setMediaProcessingMessage] = useState("");
  const [message, setMessage] = useState("");
  const [issues, setIssues] = useState<ShopValidationIssue[]>([]);
  const [inspectOn, setInspectOn] = useState(false);
  const [lockedOrder, setLockedOrder] = useState<PublicShopOrder | null>(null);
  const [lockCheckDone, setLockCheckDone] = useState(true);
  const [resumeAccessKey, setResumeAccessKey] = useState("");
  const [resumeChecked, setResumeChecked] = useState(true);
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
      return;
    }
    const resumeOrderId = resumeParams.orderId;
    const resumeKey = resumeParams.accessKey;

    let active = true;
    async function loadResumeLink() {
      setResumeChecked(false);
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
          order.siteStatus === "published"
        ) {
          setLockedOrder(order);
        } else if (order.siteStatus === "publish_failed") {
          setBuilderStarted(true);
          setMessage("Payment is recorded, but publishing failed. Review, save fixes, then retry publishing. Do not pay again.");
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
            order.siteStatus === "published");
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
  const mediaProcessing = Boolean(mediaProcessingMessage);
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
        const response = await fetch(
          mode === "start" ? "/api/shop/drafts/find-or-create" : "/api/shop/drafts/save",
          {
            body: JSON.stringify({
              accessKey: getStoredOrderAccessKey(),
              idempotencyKey: getStableShopIdempotencyKey(snapshot.orderId),
              state: snapshot
            }),
            cache: "no-store",
            headers: { "content-type": "application/json" },
            method: "POST"
          }
        );
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
      setMessage("Enter a valid email first so we can save and recover this draft.");
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

  async function startFreshBuilder() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Starting fresh will archive your previous draft. You can still ask support to recover it later. Continue?"
      )
    ) {
      return;
    }

    const existingOrderId = normalizedState.orderId.trim();
    const existingAccessKey = getStoredOrderAccessKey();
    if (existingOrderId && existingAccessKey) {
      setStartingBuilder(true);
      setMessage("Archiving your previous draft before starting fresh...");
      try {
        const response = await fetch("/api/shop/drafts/start-fresh", {
          body: JSON.stringify({
            accessKey: existingAccessKey,
            orderId: existingOrderId
          }),
          cache: "no-store",
          headers: { "content-type": "application/json" },
          method: "POST"
        });
        const payload = (await response.json().catch(() => ({}))) as { error?: string; ok?: boolean };
        if (!response.ok || !payload.ok) {
          setMessage(
            payload.error ||
              "Could not safely archive the previous draft. Use the secure resume link or contact support."
          );
          return;
        }
      } catch {
        setMessage("Network issue while archiving the previous draft. Please try again.");
        return;
      } finally {
        setStartingBuilder(false);
      }
    }

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
    if (mediaProcessing) {
      setMessage("Please wait until the coach photo finishes processing.");
      return;
    }
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
    if (mediaProcessing) {
      setMessage("Please wait until the coach photo finishes processing.");
      return;
    }
    setIssues([]);
    patchState({ currentStep: Math.max(1, normalizedState.currentStep - 1) });
  }

  async function saveDraft() {
    if (mediaProcessing) {
      setMessage("Please wait until the coach photo finishes processing before saving.");
      return;
    }
    await persistDraft(normalizedState, "manual");
  }

  async function buyAndPublish() {
    if (mediaProcessing) {
      setMessage("Please wait until the coach photo finishes processing before checkout.");
      return;
    }
    if (isPublishFailedRecovery(normalizedState)) {
      await retryPublishAfterFailure();
      return;
    }
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

  async function retryPublishAfterFailure() {
    const paymentIssues = validateShopBuilderState(normalizedState, { requirePaymentReady: true }).filter(
      (issue) => issue.severity === "error"
    );
    if (paymentIssues.length) {
      setIssues(paymentIssues);
      setMessage("Fix the required details before retrying publish.");
      return;
    }

    const accessKey = getStoredOrderAccessKey();
    if (!normalizedState.orderId || !accessKey) {
      setMessage("Open the secure resume link before retrying publish.");
      return;
    }

    setCheckoutBusy(true);
    setMessage("Saving fixes before retrying publish...");
    try {
      const saved = await persistDraft(normalizedState, "autosave");
      if (!saved) return;

      setMessage("Retrying publish. No new payment will be taken.");
      const response = await fetch("/api/shop/retry-publish", {
        body: JSON.stringify({
          accessKey,
          orderId: normalizedState.orderId
        }),
        cache: "no-store",
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as CheckoutResponse;
      if (!response.ok || !payload.ok) {
        setMessage(payload.error || "Publish retry could not complete. Please contact YWcoach support.");
        return;
      }

      if (payload.order?.siteStatus === "published") {
        setLockedOrder(payload.order);
        setMessage("Published successfully. Your live website link is ready.");
        return;
      }

      setMessage("Publish retry started. Use the status page if it is still checking.");
    } catch {
      setMessage("Publish retry could not connect. Your saved fixes are still preserved.");
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
                Begin with your email so we can safely create or resume your website draft.
                Coach details come next inside the builder.
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
                label="Email"
                onChange={(email) => patchState({ email, coachEmail: email })}
                sanitizeMode="email"
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
                <button onClick={() => void startFreshBuilder()} type="button">
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
              <small>Coach website builder</small>
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

        <section
          aria-busy={mediaProcessing}
          className={styles.workspace}
          data-media-busy={mediaProcessing ? "true" : undefined}
        >
          {mediaProcessing ? <MediaProcessingOverlay message={mediaProcessingMessage} /> : null}
          <div className={styles.topbar}>
            <div>
              <h1>Create your coach website</h1>
              <p>Build, preview, edit, and purchase a YW Nutritech-ready public website.</p>
            </div>
            <div className={styles.topbarActions}>
              <button disabled={saving || mediaProcessing} onClick={() => void saveDraft()} type="button">
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button disabled={checkoutBusy || mediaProcessing} onClick={() => void buyAndPublish()} type="button">
                {checkoutBusy ? "Preparing..." : "Buy & Publish"}
              </button>
            </div>
          </div>

          {message ? <p className={styles.statusLine}>{message}</p> : null}
          <p className={styles.autoSaveLine} data-state={autoSaveStatus}>
            {autoSaveText ||
              (normalizedState.orderId
                ? "Secure server draft is ready."
                : "Enter email to enable secure draft recovery. Coach details are required before publishing.")}
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
                <MediaContactStep
                  onMediaProcessingMessage={setMediaProcessingMessage}
                  state={normalizedState}
                  onPatch={patchState}
                />
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
                <PaymentStep
                  busy={checkoutBusy}
                  issues={currentIssues}
                  mode={isPublishFailedRecovery(normalizedState) ? "retry" : "checkout"}
                  onBuy={() => void buyAndPublish()}
                  state={normalizedState}
                />
              ) : null}
              {normalizedState.currentStep === 5 ? <SuccessPreview state={normalizedState} /> : null}

              <div className={styles.stepActions}>
                <button
                  disabled={normalizedState.currentStep === 1 || mediaProcessing}
                  onClick={previousStep}
                  type="button"
                >
                  Back
                </button>
                {normalizedState.currentStep < 4 ? (
                  <button disabled={mediaProcessing} onClick={nextStep} type="button">Next</button>
                ) : normalizedState.currentStep === 4 ? (
                  <button disabled={checkoutBusy || mediaProcessing} onClick={() => void buyAndPublish()} type="button">
                    {checkoutBusy
                      ? isPublishFailedRecovery(normalizedState)
                        ? "Retrying publish..."
                        : "Preparing checkout..."
                      : isPublishFailedRecovery(normalizedState)
                        ? "Retry Publish"
                        : "Buy & Publish"}
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
      <TemplateSkinPicker
        onChange={(selectedThemeId) => onPatch({ selectedThemeId })}
        value={state.selectedThemeId}
      />
      <button className={styles.secondaryButton} onClick={onRegenerate} type="button">
        Improve website copy
      </button>
    </div>
  );
}

function MediaProcessingOverlay({ message }: { message: string }) {
  return (
    <div className={styles.mediaProcessingOverlay} role="status" aria-live="polite">
      <div className={styles.mediaProcessingCard}>
        <span className={styles.mediaProcessingSpinner} aria-hidden="true" />
        <p>Preparing transparent coach photo</p>
        <strong>Please wait. Keep this builder open.</strong>
        <small>{message || "Creating a clean cutout and saving it securely..."}</small>
        <ul>
          <li>Removing the photo background</li>
          <li>Saving the processed cutout</li>
          <li>Updating preview and publish data</li>
        </ul>
      </div>
    </div>
  );
}

function TemplateSkinPicker({
  onChange,
  value
}: {
  onChange: (value: CoachTemplateThemeId) => void;
  value: CoachTemplateThemeId;
}) {
  return (
    <label className={styles.skinPicker}>
      <span>Visual skin</span>
      <select
        onChange={(event) => onChange(event.target.value as CoachTemplateThemeId)}
        value={value}
      >
        {coachTemplateThemes.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.name}
          </option>
        ))}
      </select>
      <small>
        Changes only color, typography, background, and card styling. Content, links, legal,
        analytics, and bonus rules stay locked to the canonical template.
      </small>
    </label>
  );
}

function MediaContactStep({
  onMediaProcessingMessage,
  onPatch,
  state
}: {
  onMediaProcessingMessage: (message: string) => void;
  onPatch: (patch: Partial<ShopBuilderState>) => void;
  state: ShopBuilderState;
}) {
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadingMediaType, setUploadingMediaType] = useState<"" | "image" | "video">("");
  const [coachImageResult, setCoachImageResult] = useState<CoachImageMediaResult | null>(null);
  const [temporaryImagePreviewUrl, setTemporaryImagePreviewUrl] = useState("");
  const [temporaryVideoPreviewUrl, setTemporaryVideoPreviewUrl] = useState("");
  const imagePreviewUrl = temporaryImagePreviewUrl || state.photoUrl || state.logoUrl;
  const videoEmbedUrl = normalizeVideoEmbedUrl(state.videoUrl);
  const uploadedVideoUrl =
    temporaryVideoPreviewUrl || (isUploadedVideoSource(state.videoUrl) ? state.videoUrl : "");
  const videoInvalid =
    state.heroMediaType === "video" && state.videoUrl.trim() && !videoEmbedUrl && !uploadedVideoUrl;
  const setImageUploadProgress = useCallback(
    (nextMessage: string) => {
      setUploadMessage(nextMessage);
      onMediaProcessingMessage(nextMessage);
    },
    [onMediaProcessingMessage]
  );

  useEffect(() => {
    const preloadTimer = window.setTimeout(() => {
      void preloadCoachHeroPhotoBackgroundRemoval();
    }, 180000);

    return () => window.clearTimeout(preloadTimer);
  }, []);

  async function handleMediaUpload(file: File | undefined, mediaType: "image" | "video") {
    if (!file) return;

    const maxBytes = mediaType === "image" ? SHOP_PHOTO_MAX_BYTES : SHOP_VIDEO_MAX_BYTES;
    if (file.size > maxBytes) {
      setUploadMessage(
        mediaType === "image"
          ? "Photo is too large. Upload a photo under 12 MB or use a secure HTTPS image link."
          : "Video is too large. Upload a video under 70 MB or use a YouTube/secure video link."
      );
      return;
    }

    if (mediaType === "image" && !isAllowedShopPhotoFile(file)) {
      setUploadMessage("Upload JPEG, PNG, WebP, AVIF, GIF, HEIC, HEIF, BMP, or TIFF.");
      return;
    }

    if (mediaType === "video" && !isAllowedShopVideoFile(file)) {
      setUploadMessage("Upload a supported video file up to 70 MB, or paste a YouTube/video URL.");
      return;
    }

    const previousUrl = mediaType === "image" ? state.photoUrl : state.videoUrl;
    setUploadingMediaType(mediaType);
    if (mediaType === "image") setCoachImageResult(null);
    const initialMessage =
      mediaType === "image"
        ? "Preparing your coach photo..."
        : `Uploading ${file.name} securely...`;
    setUploadMessage(initialMessage);
    if (mediaType === "image") onMediaProcessingMessage(initialMessage);

    const previewUrl = URL.createObjectURL(file);
    const uploadedFile = file;
    let cutoutFile: File | null = null;

    if (mediaType === "image") {
      setTemporaryImagePreviewUrl(previewUrl);
      onPatch({ heroMediaType: "image" });
    } else {
      setTemporaryVideoPreviewUrl(previewUrl);
      onPatch({ heroMediaType: "video" });
    }
    setUploadMessage(initialMessage);
    if (mediaType === "image") onMediaProcessingMessage(initialMessage);

    try {
      if (mediaType === "image") {
        const preparedPhoto = await prepareCoachHeroPhotoForUpload(file, {
          maxBytes: SHOP_PHOTO_MAX_BYTES,
          onProgress: setImageUploadProgress
        });
        cutoutFile = preparedPhoto.file;
        setImageUploadProgress("Saving transparent coach photo securely...");
      }

      const formData = new FormData();
      formData.append("file", uploadedFile);
      if (cutoutFile) formData.append("cutoutFile", cutoutFile);
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
        setUploadMessage(payload.error || "Media upload was unavailable. Please try again.");
        return;
      }

      const stableMediaUrl =
        mediaType === "image"
          ? payload.media.cutoutUrl || payload.media.publicUrl
          : payload.media.publicUrl;

      onPatch(
        mediaType === "image"
          ? { heroMediaType: "image", photoUrl: stableMediaUrl }
          : { heroMediaType: "video", videoUrl: stableMediaUrl }
      );
      if (mediaType === "image") {
        setCoachImageResult(payload.media);
        setTemporaryImagePreviewUrl("");
        onMediaProcessingMessage("");
      } else {
        setTemporaryVideoPreviewUrl("");
      }
      setUploadMessage(
        mediaType === "image"
          ? getCoachImageUploadMessage(payload.media, file)
          : `${uploadedFile.name} uploaded and saved securely (${formatBytes(uploadedFile.size)}).`
      );
    } catch (error) {
      onPatch(mediaType === "image" ? { photoUrl: previousUrl } : { videoUrl: previousUrl });
      if (mediaType === "image") onMediaProcessingMessage("");
      setUploadMessage(
        error instanceof Error
          ? error.message
          : "Media upload could not connect. Please try again."
      );
    } finally {
      URL.revokeObjectURL(previewUrl);
      if (mediaType === "image") {
        setTemporaryImagePreviewUrl((current) => (current === previewUrl ? "" : current));
      } else {
        setTemporaryVideoPreviewUrl((current) => (current === previewUrl ? "" : current));
      }
      setUploadingMediaType("");
      if (mediaType === "image") onMediaProcessingMessage("");
    }
  }

  function handleUseImageUrl(url: string | undefined, label: "cutout" | "original") {
    if (!url) return;
    setTemporaryImagePreviewUrl("");
    onPatch({ heroMediaType: "image", photoUrl: url });
    setUploadMessage(
      label === "cutout"
        ? "Using the transparent coach cutout."
        : "Using the original photo in the portrait frame."
    );
  }

  function handleResetImage() {
    setCoachImageResult(null);
    setTemporaryImagePreviewUrl("");
    onPatch({ photoUrl: "" });
    setUploadMessage("Coach photo cleared. Upload another image when ready.");
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
          <Field
            label="Photo/logo URL"
            value={state.photoUrl}
            onChange={(photoUrl) => {
              setCoachImageResult(null);
              onPatch({ photoUrl });
            }}
            placeholder="https://..."
          />
          <div className={styles.mediaPreview} data-state={imagePreviewUrl ? "ready" : "empty"}>
            {imagePreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="Uploaded coach media preview" src={imagePreviewUrl} />
            ) : (
              <span>Photo preview</span>
            )}
          </div>
          {coachImageResult ? (
            <CoachImageResultPanel
              activeUrl={state.photoUrl}
              disabled={uploadingMediaType === "image"}
              media={coachImageResult}
              onReset={handleResetImage}
              onUse={handleUseImageUrl}
            />
          ) : imagePreviewUrl ? (
            <button className={styles.secondaryButton} onClick={handleResetImage} type="button">
              Reset image
            </button>
          ) : null}
        </div>
      ) : null}

      {state.heroMediaType === "video" ? (
        <div className={styles.mediaUploadGrid}>
          <label className={styles.uploadField}>
            <span>Upload coach video</span>
            <input
              accept={VIDEO_UPLOAD_ACCEPT}
              disabled={uploadingMediaType === "video"}
              onChange={(event) => void handleMediaUpload(event.target.files?.[0], "video")}
              type="file"
            />
            <small>
              {uploadingMediaType === "video"
                ? "Uploading video securely..."
                : "Upload a supported video up to 70 MB, or paste a YouTube/video link."}
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
      <Field
        label="Email"
        value={state.email}
        onChange={(email) => onPatch({ email, coachEmail: email })}
        sanitizeMode="email"
      />
      <Field
        label="Phone/WhatsApp"
        value={state.coachPhone}
        onChange={(coachPhone) => onPatch({ coachPhone })}
        sanitizeMode="phone"
      />
      <Field
        helper="Paste one public HTTPS registration link only."
        label="Registration/contact link"
        value={state.contactLink}
        onChange={(contactLink) => onPatch({ contactLink })}
        sanitizeMode="url"
      />
    </div>
  );
}

function CoachImageResultPanel({
  activeUrl,
  disabled,
  media,
  onReset,
  onUse
}: {
  activeUrl: string;
  disabled: boolean;
  media: CoachImageMediaResult;
  onReset: () => void;
  onUse: (url: string | undefined, label: "cutout" | "original") => void;
}) {
  const hasCutout = Boolean(media.cutoutUrl);

  return (
    <div className={styles.imageResultPanel} data-status={media.processingStatus || "unknown"}>
      <div>
        <strong>{getCoachImageResultTitle(media)}</strong>
        <span>{getCoachImageResultDescription(media)}</span>
      </div>
      <div className={styles.imageResultActions}>
        {hasCutout ? (
          <button
            data-active={activeUrl === media.cutoutUrl ? "true" : undefined}
            disabled={disabled}
            onClick={() => onUse(media.cutoutUrl, "cutout")}
            type="button"
          >
            Use cutout
          </button>
        ) : null}
        {media.originalUrl ? (
          <button
            data-active={activeUrl === media.originalUrl ? "true" : undefined}
            disabled={disabled}
            onClick={() => onUse(media.originalUrl, "original")}
            type="button"
          >
            Use original frame
          </button>
        ) : null}
        <button disabled={disabled} onClick={onReset} type="button">
          Reset image
        </button>
      </div>
    </div>
  );
}

function getCoachImageUploadMessage(media: NonNullable<MediaUploadResponse["media"]>, file?: File) {
  if (media.processingStatus === "cutout_ready") {
    return `Coach photo is ready${media.sizeBytes || file?.size ? ` (${formatBytes(media.sizeBytes || file?.size || 0)})` : ""}.`;
  }

  if (media.processingStatus === "not_configured") {
    return "Photo uploaded, but the transparent cutout was not created. Upload a clearer photo and try again.";
  }

  if (media.safeMessage) {
    return media.safeMessage;
  }

  return `Coach photo uploaded${file?.size ? ` (${formatBytes(file.size)})` : ""}.`;
}

function getCoachImageResultTitle(media: CoachImageMediaResult) {
  if (media.processingStatus === "cutout_ready") return "Cutout ready";
  if (media.processingStatus === "framed_fallback") return "Original frame active";
  if (media.processingStatus === "not_configured") return "Cutout not created";
  if (media.processingStatus === "disabled") return "Original uploaded";
  return "Coach photo uploaded";
}

function getCoachImageResultDescription(media: CoachImageMediaResult) {
  if (media.processingStatus === "cutout_ready") {
    return "A transparent coach photo is saved. You can still switch back to the original photo.";
  }

  if (media.safeMessage) return media.safeMessage;

  return "The original photo is stored for this coach site.";
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
  mode,
  onBuy,
  state
}: {
  busy: boolean;
  issues: ShopValidationIssue[];
  mode: "checkout" | "retry";
  onBuy: () => void;
  state: ShopBuilderState;
}) {
  const retryMode = mode === "retry";
  return (
    <div className={styles.stepPanel}>
      <span className={styles.stepEyebrow}>Step 4</span>
      <h2>{retryMode ? "Review and retry publish" : "Review and secure checkout"}</h2>
      <p>
        {retryMode
          ? "Payment is already recorded. Save any fixes and retry publishing without another checkout."
          : "Your site is saved as pending payment first. It publishes only after server-side payment verification is connected and confirmed."}
      </p>
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
        {busy
          ? retryMode
            ? "Retrying publish..."
            : "Preparing secure checkout..."
          : retryMode
            ? "Retry Publish"
            : "Buy & Publish"}
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
        <span>Your coach website has been published.</span>
        <code>/coach/{state.slug || "coach-slug"}</code>
      </div>
    </div>
  );
}

function Field({
  helper,
  label,
  onChange,
  placeholder,
  sanitizeMode,
  textarea,
  value
}: {
  helper?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  sanitizeMode?: "email" | "phone" | "url";
  textarea?: boolean;
  value: string;
}) {
  function handlePaste(event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (!sanitizeMode) return;
    const pasted = event.clipboardData.getData("text");
    const sanitized = sanitizeSingleFieldPaste(pasted, sanitizeMode, value);
    event.preventDefault();
    if (sanitized === null) return;
    onChange(sanitized);
  }

  return (
    <label className={styles.field}>
      <span>{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onPaste={handlePaste}
          placeholder={placeholder}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onPaste={handlePaste}
          placeholder={placeholder}
        />
      )}
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

function sanitizeSingleFieldPaste(
  pasted: string,
  mode: "email" | "phone" | "url",
  currentValue: string
) {
  const raw = pasted.trim();
  if (!raw) return "";

  if (mode === "url") {
    const matches = raw.match(/https:\/\/(?:(?!https?:\/\/)[^\s,;])+/gi) || [];
    const unique = Array.from(new Set(matches.map((item) => item.trim())));
    if (unique.length === 1) return unique[0];
    if (unique.length > 1) return null;
    return raw;
  }

  if (mode === "email") {
    const matches = raw.match(/[^\s,;@]+@[^\s,;@]+\.[^\s,;@]+/gi) || [];
    const unique = Array.from(new Set(matches.map((item) => item.trim().toLowerCase())));
    if (unique.length === 1) return unique[0];
    if (unique.length > 1) return null;
    return raw.toLowerCase();
  }

  const digits = raw.replace(/\D/g, "");
  const normalized = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  const currentDigits = currentValue.replace(/\D/g, "");
  const normalizedCurrent =
    currentDigits.length === 12 && currentDigits.startsWith("91") ? currentDigits.slice(2) : currentDigits;
  if (normalized.length === 10 && normalized === normalizedCurrent) return normalized;
  if (normalized.length === 10) return normalized;
  return null;
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
  if (ALLOWED_VIDEO_TYPES.has(contentType)) return true;
  return Boolean(
    extension &&
      ALLOWED_VIDEO_EXTENSIONS.has(extension) &&
      (contentType === "" || contentType === "application/octet-stream" || contentType.startsWith("video/"))
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
  const accessKey = getStoredOrderAccessKey();
  return accessKey ? { "x-shop-access-key": accessKey } : {};
}

function getStoredOrderAccessKey() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ORDER_ACCESS_KEY_STORAGE_KEY) || "";
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
  return isValidShopEmail(state.email || state.coachEmail);
}

function getEntryValidationIssues(state: ShopBuilderState): ShopValidationIssue[] {
  const issues: ShopValidationIssue[] = [];
  if (!isValidShopEmail(state.email || state.coachEmail)) {
    issues.push({ field: "email", message: "Enter a valid email to save or recover this draft.", severity: "error" });
  }
  return issues;
}

function isValidShopEmail(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || /[\s,;]/.test(trimmed)) return false;
  if ((trimmed.match(/@/g) || []).length !== 1) return false;
  return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(trimmed);
}

function isPublishFailedRecovery(state: ShopBuilderState) {
  return state.status === "publish_failed";
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
