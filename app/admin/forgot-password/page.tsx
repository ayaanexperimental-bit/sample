import type { Metadata } from "next";
import { AdminAuthShell } from "../../../components/admin/admin-auth-shell";

export const metadata: Metadata = {
  title: "Reset Admin Password | YW Coach",
  description: "Admin password reset request for the YW Coach platform.",
  robots: {
    follow: false,
    index: false
  }
};

export default function AdminForgotPasswordPage() {
  return <AdminAuthShell initialStep="forgot" />;
}
