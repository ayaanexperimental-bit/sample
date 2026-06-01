import type { Metadata } from "next";
import { AdminAuthShell } from "../../../components/admin/admin-auth-shell";

export const metadata: Metadata = {
  title: "Admin Login | YW Coach",
  description: "Secure admin login for the YW Coach platform.",
  robots: {
    follow: false,
    index: false
  }
};

export default function AdminLoginPage() {
  return <AdminAuthShell initialStep="login" />;
}
