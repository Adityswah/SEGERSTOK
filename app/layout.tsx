import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "STOKARA - Soto Seger Joyoboyo",
  description: "Sistem stok operasional Soto Seger Joyoboyo yang hangat, akuntabel, dan siap diaudit.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#B8962E",
  width: "device-width",
  initialScale: 1,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
