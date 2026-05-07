import type { Metadata } from "next";
import { Bodoni_Moda, Cormorant_Garamond, Libre_Baskerville, Manrope, Montserrat } from "next/font/google";
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
      <body
        className={`${displayFont.variable} ${accentFont.variable} ${editorialFont.variable} ${bodyFont.variable} ${conversionFont.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
