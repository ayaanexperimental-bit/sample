import type { Metadata } from "next";
import { AdminAuthShell } from "../../../components/admin/admin-auth-shell";

export const metadata: Metadata = {
  title: "Verify Admin Identity | YW Coach",
  description: "Admin OTP verification for the YW Coach platform.",
  robots: {
    follow: false,
    index: false
  }
};

export default function AdminVerifyPage() {
  return <AdminAuthShell initialStep="verify" />;
}
