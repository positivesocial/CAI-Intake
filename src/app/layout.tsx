import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CAI Intake - Cutlist Data Ingestion",
  description:
    "The definitive cutlist data ingestion engine for cabinet & woodworking workshops. Transform messy input into clean, optimized cutlists.",
  keywords: [
    "cutlist",
    "cabinet",
    "woodworking",
    "panel optimization",
    "CNC",
    "edge banding",
    "CAI",
    "CabinetAI",
  ],
  authors: [{ name: "PositiveSocial" }],
  openGraph: {
    title: "CAI Intake - Cutlist Data Ingestion",
    description:
      "Transform messy cutlist data into clean, optimized formats. Manual entry, Excel import, voice dictation, OCR, and more.",
    type: "website",
    siteName: "CAI Intake",
  },
  twitter: {
    card: "summary_large_image",
    title: "CAI Intake - Cutlist Data Ingestion",
    description:
      "Transform messy cutlist data into clean, optimized formats. Part of the CabinetAI ecosystem.",
  },
  icons: {
    icon: "/branding/logo-icon.svg",
    apple: "/branding/logo-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
