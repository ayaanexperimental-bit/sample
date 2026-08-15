import type { ReactNode } from "react";

export function AdminV2PortalScope({
  children,
  theme
}: {
  children: ReactNode;
  theme: "dark" | "light";
}) {
  return (
    <div data-admin-v2="true" data-od-theme={theme} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
