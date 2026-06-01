import type { Metadata } from "next";
import { AdminAuthShell } from "../../components/admin/admin-auth-shell";

export const metadata: Metadata = {
  title: "Admin | YW Coach",
  description: "Secure admin access for the YW Coach platform.",
  robots: {
    follow: false,
    index: false
  }
};

export default function AdminPage() {
  // TODO: Add final server-rendered admin route protection when dynamic hosting/auth provider is finalized.
  return <AdminAuthShell initialStep="login" />;
}
