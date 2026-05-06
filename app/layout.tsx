import type { Metadata } from "next";
import { Fraunces, Nunito_Sans } from "next/font/google";
import "./globals.css";

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800", "900"],
  display: "swap"
});

const bodyFont = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "600", "700", "800", "900"],
  display: "swap"
});

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
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>{children}</body>
    </html>
  );
}
