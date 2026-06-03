import type { Metadata } from "next";
import { AdminAuthShell } from "../../../components/admin/admin-auth-shell";

export const metadata: Metadata = {
  title: "Update Admin Password | YW Coach",
  description: "Admin password update page for the YW Coach platform.",
  robots: {
    follow: false,
    index: false
  }
};

export default function AdminResetPasswordPage() {
  return <AdminAuthShell initialStep="reset" />;
}
