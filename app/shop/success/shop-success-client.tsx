"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import styles from "../shop-builder.module.css";

const ORDER_ACCESS_KEY_STORAGE_KEY = "ywcoach-shop-order-access-key-v1";
const SHOP_BUILDER_DRAFT_STORAGE_KEY = "ywcoach-shop-builder-draft-v1";
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@ywcoach.com";
const INACTIVE_SITE_STATUSES = new Set(["archived", "paused", "publish_failed", "removed"]);

type ShopOrder = {
  coachName: string;
  orderId: string;
  publicUrl: string;
  siteStatus: string;
  workflowStage: string;
};

export function ShopSuccessClient() {
  const [orderId] = useState(getInitialShopOrderId);
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastCheckedAt, setLastCheckedAt] = useState("");
  const [claimPaymentId, setClaimPaymentId] = useState("");
  const [claimEmail, setClaimEmail] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState("");
  const [autoRecovering, setAutoRecovering] = useState(false);
  const [autoRecoveryMessage, setAutoRecoveryMessage] = useState("");
  const [message, setMessage] = useState(
    orderId ? "Checking website publish status..." : "No shop order was found in this link."
  );

  const autoRecoverPayment = useCallback(
    async (currentOrder: ShopOrder) => {
      if (!orderId || autoRecovering) return;

      setAutoRecovering(true);
      setAutoRecoveryMessage("Checking Razorpay payment confirmation...");
      try {
        const accessKey =
          typeof window === "undefined"
            ? ""
            : window.localStorage.getItem(ORDER_ACCESS_KEY_STORAGE_KEY) || "";
        const response = await fetch("/api/shop/reconcile-payment", {
          body: JSON.stringify({ orderId: currentOrder.orderId }),
          cache: "no-store",
          headers: {
            "content-type": "application/json",
            ...(accessKey ? { "x-shop-access-key": accessKey } : {})
          },
          method: "POST"
        });
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          ok?: boolean;
          order?: ShopOrder | null;
          recovered?: boolean;
        };

        if (!response.ok && response.status !== 202) {
          setAutoRecoveryMessage(payload.error || "Automatic payment check is temporarily unavailable.");
          return;
        }

        if (payload.ok && payload.order) {
          setOrder(payload.order);
          setMessage(
            payload.order.siteStatus === "published"
              ? "Payment verified. Your website is published."
              : "Payment verified. Publishing is finishing now."
          );
          setAutoRecoveryMessage(
            payload.recovered
              ? "Razorpay payment found and linked automatically."
              : "Website status loaded."
          );
          setRefreshKey((current) => current + 1);
          return;
        }

        setAutoRecoveryMessage(payload.error || "Still waiting for Razorpay confirmation.");
      } catch {
        setAutoRecoveryMessage("Automatic payment check had a network issue. Retrying...");
      } finally {
        setAutoRecovering(false);
      }
    },
    [autoRecovering, orderId]
  );

  useEffect(() => {
    if (!orderId) return;

    async function loadOrder() {
      setLoading(true);
      try {
        const accessKey =
          typeof window === "undefined"
            ? ""
            : window.localStorage.getItem(ORDER_ACCESS_KEY_STORAGE_KEY) || "";
        const response = await fetch(`/api/shop/order?order=${encodeURIComponent(orderId)}`, {
          cache: "no-store",
          headers: accessKey ? { "x-shop-access-key": accessKey } : {}
        });
        const payload = (await response.json().catch(() => ({}))) as { order?: ShopOrder };
        setOrder(payload.order || null);
        const status = payload.order?.siteStatus || "";
        setMessage(
          status === "protected"
            ? "This order status is protected. Open this page from the same browser used during checkout, or wait until publishing is complete."
            : payload.order
              ? status === "published"
                ? "Website status loaded."
                : INACTIVE_SITE_STATUSES.has(status)
                  ? "This website is not currently live. Contact support before taking any more payment action."
                  : "Checking Razorpay confirmation automatically. Do not pay again."
              : "This shop order was not found."
        );
        setLastCheckedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
        if (
          payload.order &&
          status !== "published" &&
          status !== "protected" &&
          !INACTIVE_SITE_STATUSES.has(status)
        ) {
          void autoRecoverPayment(payload.order);
        }
      } catch {
        setMessage("Could not check this shop order right now.");
      } finally {
        setLoading(false);
      }
    }

    void loadOrder();
  }, [autoRecoverPayment, orderId, refreshKey]);

  const published = order?.siteStatus === "published";
  const inactive = Boolean(order?.siteStatus && INACTIVE_SITE_STATUSES.has(order.siteStatus));
  const shouldAutoRefresh = Boolean(
    orderId && !published && !inactive && order?.siteStatus !== "protected"
  );
  const showPendingPaymentHelp = Boolean(
    orderId && !published && !inactive && order?.siteStatus !== "protected"
  );
  const supportHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    `Shop website payment pending: ${orderId || "unknown order"}`
  )}`;

  useEffect(() => {
    if (!shouldAutoRefresh) return;

    const timer = window.setTimeout(() => {
      setRefreshKey((current) => current + 1);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [refreshKey, shouldAutoRefresh]);

  async function handleClaimPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orderId || claiming) return;

    setClaiming(true);
    setClaimMessage("");
    try {
      const accessKey =
        typeof window === "undefined"
          ? ""
          : window.localStorage.getItem(ORDER_ACCESS_KEY_STORAGE_KEY) || "";
      const response = await fetch("/api/shop/claim-payment", {
        body: JSON.stringify({
          orderId,
          payerEmail: claimEmail,
          paymentId: claimPaymentId
        }),
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          ...(accessKey ? { "x-shop-access-key": accessKey } : {})
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        order?: ShopOrder | null;
      };

      if (!response.ok || !payload.ok) {
        setClaimMessage(payload.error || "Could not verify this payment yet.");
        return;
      }

      setOrder(payload.order || null);
      setMessage("Payment verified. Website status loaded.");
      setClaimMessage("Payment verified. Your website link is ready.");
      setRefreshKey((current) => current + 1);
    } catch {
      setClaimMessage("Could not verify this payment right now.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <main className={styles.shopPage}>
      <section className={`${styles.shell} ${styles.statusShell}`}>
        <div className={styles.workspace}>
            <div className={styles.topbar}>
            <div>
              <h1>
                {published
                  ? `Congratulations, Coach ${order?.coachName || ""}!`
                  : inactive
                    ? "Website needs support review"
                    : "Website payment status"}
              </h1>
              <p>
                {published
                  ? "Your premium coach website has been published."
                  : inactive
                    ? "Payment is not lost, but this website is not currently available as a live public page."
                    : "Your website is not shown as published yet. Payment verification may still be pending."}
              </p>
            </div>
          </div>
          <div className={styles.panel}>
            <div className={published ? styles.successCard : styles.reviewWarning}>
              <strong>
                {published
                  ? "Your premium website is now live and ready to share with clients."
                  : loading
                    ? "Checking status..."
                    : inactive
                      ? "This website is not live right now."
                      : "Publishing is not verified yet."}
              </strong>
              <p className={styles.statusMessage}>{message}</p>
              {order ? (
                <div className={styles.orderMeta}>
                  <span>Order</span>
                  <code>{order.orderId}</code>
                </div>
              ) : null}
              {published && order?.publicUrl ? (
                <div className={styles.orderMeta}>
                  <span>Website</span>
                  <code>{order.publicUrl}</code>
                </div>
              ) : null}
              {lastCheckedAt ? <span className={styles.lastChecked}>Last checked {lastCheckedAt}</span> : null}
            </div>
            {showPendingPaymentHelp ? (
              <div className={styles.pendingPaymentHelp}>
                <strong>
                  {autoRecovering
                    ? "Checking Razorpay automatically..."
                    : "If payment is already completed, do not pay again."}
                </strong>
                <span>
                  This page searches signed Razorpay confirmation and publishes your website
                  automatically when payment is found.
                </span>
                {autoRecoveryMessage ? <span>{autoRecoveryMessage}</span> : null}
                <details className={styles.paymentClaimDetails}>
                  <summary>Manual payment check</summary>
                  <form className={styles.paymentClaimForm} onSubmit={handleClaimPayment}>
                    <span>Use only if support asks for the Razorpay payment id.</span>
                    <label>
                      Razorpay payment id
                      <input
                        autoComplete="off"
                        inputMode="text"
                        onChange={(event) => setClaimPaymentId(event.target.value)}
                        placeholder="pay_..."
                        required
                        type="text"
                        value={claimPaymentId}
                      />
                    </label>
                    <label>
                      Payment email
                      <input
                        autoComplete="email"
                        inputMode="email"
                        onChange={(event) => setClaimEmail(event.target.value)}
                        placeholder="name@example.com"
                        required
                        type="email"
                        value={claimEmail}
                      />
                    </label>
                    <button disabled={claiming} type="submit">
                      {claiming ? "Verifying..." : "Verify Payment"}
                    </button>
                    {claimMessage ? <span>{claimMessage}</span> : null}
                  </form>
                </details>
                <a href={supportHref}>Contact Support</a>
              </div>
            ) : null}
            {inactive && orderId ? (
              <div className={styles.pendingPaymentHelp}>
                <strong>Do not pay again for this order.</strong>
                <span>
                  The paid order exists, but the linked public website is not live. Support can
                  review the order and restore or correct the site safely.
                </span>
                <a href={supportHref}>Contact Support</a>
              </div>
            ) : null}
            <div className={styles.stepActions}>
              {published && order?.publicUrl ? (
                <>
                  <a className={styles.buyButton} href={order.publicUrl} target="_blank" rel="noreferrer">
                    Open Website
                  </a>
                  <button
                    onClick={() => void navigator.clipboard.writeText(new URL(order.publicUrl, window.location.origin).toString())}
                    type="button"
                  >
                    Copy Link
                  </button>
                </>
              ) : (
                <>
                  {orderId ? (
                    <button
                      className={styles.buyButton}
                      disabled={loading}
                      onClick={() => setRefreshKey((current) => current + 1)}
                      type="button"
                    >
                      {loading ? "Checking..." : "Refresh Status"}
                    </button>
                  ) : null}
                  <a className={styles.buyButton} href="/shop">
                    Return to Shop Builder
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function getInitialShopOrderId() {
  if (typeof window === "undefined") return "";

  const params = new URLSearchParams(window.location.search);
  const queryOrderId = params.get("order") || params.get("shop_order_id") || "";
  if (queryOrderId.trim()) return queryOrderId.trim();

  try {
    const storedDraft = window.localStorage.getItem(SHOP_BUILDER_DRAFT_STORAGE_KEY);
    if (!storedDraft) return "";

    const parsed = JSON.parse(storedDraft) as { orderId?: unknown };
    return typeof parsed.orderId === "string" ? parsed.orderId.trim() : "";
  } catch {
    return "";
  }
}
