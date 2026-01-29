import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PingLogProvider } from "@/stores/pingLogStore";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mapee - Crowdsourced Network Map",
  description: "Discover and share network connectivity data in your area",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className={inter.className}>
        <PingLogProvider>
          {children}
          <Toaster />
        </PingLogProvider>
      </body>
    </html>
  );
}
