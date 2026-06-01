import type { Metadata } from "next";
import {
  Bodoni_Moda,
  Cormorant_Garamond,
  Libre_Baskerville,
  Manrope,
  Montserrat
} from "next/font/google";
import "./globals.css";

const displayFont = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800", "900"],
  display: "swap"
});

const accentFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-accent",
  weight: ["500", "600", "700"],
  display: "swap"
});

const editorialFont = Libre_Baskerville({
  subsets: ["latin"],
  variable: "--font-editorial",
  weight: ["400", "700"],
  display: "swap"
});

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap"
});

const conversionFont = Montserrat({
  subsets: ["latin"],
  variable: "--font-conversion",
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "YW Coach",
  description: "Coach-led wellness funnels by Yours Wellness.",
  applicationName: "YW Coach",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://ywcoach.com"),
  openGraph: {
    title: "YW Coach",
    description: "Coach-led wellness funnels by Yours Wellness.",
    type: "website"
  },
  robots: {
    index: true,
    follow: true
  },
  icons: {
    apple: "/images/yw-nutritech-logo.png",
    icon: "/images/yw-nutritech-logo.png",
    shortcut: "/images/yw-nutritech-logo.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${displayFont.variable} ${accentFont.variable} ${editorialFont.variable} ${bodyFont.variable} ${conversionFont.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
