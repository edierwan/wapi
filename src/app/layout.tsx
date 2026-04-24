import type { Metadata, Viewport } from "next";
import "./globals.css";
import { appConfig } from "@/config/app";

export const metadata: Metadata = {
  metadataBase: new URL(appConfig.url),
  title: {
    default: `${appConfig.name} — ${appConfig.tagline}`,
    template: `%s · ${appConfig.name}`,
  },
  description: appConfig.description,
  applicationName: appConfig.name,
  keywords: [
    "WhatsApp",
    "WhatsApp marketing",
    "business messaging",
    "campaigns",
    "shared inbox",
    "SaaS",
    appConfig.name,
  ],
  authors: [{ name: "Getouch" }],
  creator: "Getouch",
  openGraph: {
    type: "website",
    url: appConfig.url,
    title: `${appConfig.name} — ${appConfig.tagline}`,
    description: appConfig.description,
    siteName: appConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    title: `${appConfig.name} — ${appConfig.tagline}`,
    description: appConfig.description,
  },
  icons: {
    icon: "/favicon.svg",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f0d" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
