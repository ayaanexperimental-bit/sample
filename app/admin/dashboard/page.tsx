import type { Metadata } from "next";
import { AdminAuthShell } from "../../../components/admin/admin-auth-shell";

export const metadata: Metadata = {
  title: "Admin Dashboard | YW Coach",
  description: "Protected admin dashboard area for the YW Coach platform.",
  robots: {
    follow: false,
    index: false
  }
};

export default function AdminDashboardPage() {
  return <AdminAuthShell initialStep="dashboard" requireSession />;
}
