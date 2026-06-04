"use client";

import { useEffect, useState } from "react";
import { ContactSupportFallback } from "../components/support/contact-support-fallback";
import { createSupportErrorReference } from "../lib/error-reporting";

export default function NotFoundPage() {
  const [routeState, setRouteState] = useState<"checking" | "public">("checking");

  useEffect(() => {
    if (isAdminRecoveryPath(window.location.pathname)) {
      window.location.replace("/admin/dashboard");
      return;
    }

    const timeout = window.setTimeout(() => setRouteState("public"), 0);

    return () => window.clearTimeout(timeout);
  }, []);

  if (routeState === "checking") {
    return (
      <main
        style={{
          alignItems: "center",
          background: "linear-gradient(135deg, #fff7fb 0%, #eefcff 100%)",
          color: "#172033",
          display: "flex",
          minHeight: "100vh",
          justifyContent: "center",
          padding: "24px",
          textAlign: "center"
        }}
      >
        <section
          style={{
            background: "rgba(255, 255, 255, 0.82)",
            border: "1px solid rgba(20, 42, 70, 0.12)",
            borderRadius: "20px",
            boxShadow: "0 24px 80px rgba(20, 42, 70, 0.12)",
            maxWidth: "420px",
            padding: "28px",
            width: "100%"
          }}
        >
          <p
            style={{
              color: "#007f78",
              fontSize: "12px",
              fontWeight: 800,
              letterSpacing: "0.12em",
              margin: "0 0 10px",
              textTransform: "uppercase"
            }}
          >
            Admin Security
          </p>
          <h1 style={{ fontSize: "28px", margin: "0 0 10px" }}>Checking Session</h1>
          <p style={{ color: "#5b6475", margin: 0 }}>
            Verifying whether an admin session already exists.
          </p>
        </section>
      </main>
    );
  }

  return (
    <ContactSupportFallback
      category="route_not_found"
      message="The page you opened is not available. Please contact support for help."
      referenceId={createSupportErrorReference("route_not_found", "not-found")}
      safeMessage="Route not found."
      userAction="route_not_found"
    />
  );
}

function isAdminRecoveryPath(pathname: string) {
  const normalizedPathname = pathname.toLowerCase().replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  const safePathname = normalizedPathname || "/";

  if (safePathname === "/admin" || safePathname.startsWith("/admin/")) {
    return true;
  }

  return new Set([
    "/admin-dashboard",
    "/admin_dashboard",
    "/admin-panel",
    "/admin_panel",
    "/adminpanel",
    "/admin-login",
    "/adminlogin",
    "/dashboard"
  ]).has(safePathname);
}
