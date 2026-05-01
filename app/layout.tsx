import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WOMEN HEALTH MASTERCLASS 101",
  description: "AN INTEGRATED AND HOLISTIC APPROACH FOR PCOS/PCOD",
  applicationName: "WOMEN HEALTH MASTERCLASS 101",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "WOMEN HEALTH MASTERCLASS 101",
    description: "AN INTEGRATED AND HOLISTIC APPROACH FOR PCOS/PCOD",
    type: "website"
  },
  robots: {
    index: true,
    follow: true
  },
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
