import type { ReactNode } from "react";

export function AdminV2PortalScope({
  active = true,
  children,
  theme
}: {
  active?: boolean;
  children: ReactNode;
  theme: "dark" | "light";
}) {
  return (
    <div
      data-admin-v2={active ? "true" : undefined}
      data-od-theme={theme}
      style={{ display: "contents" }}
    >
      {children}
    </div>
  );
}
