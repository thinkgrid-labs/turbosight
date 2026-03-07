import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TurbosightProvider, TurbosightOverlay } from "@think-grid-labs/turbosight";
import { TurbosightSetup } from "./turbosight-setup";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Turbosight Test App",
  description: "Testing boundary detection",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TurbosightProvider>
          <TurbosightSetup />
          {children}
          <TurbosightOverlay />
        </TurbosightProvider>
      </body>
    </html>
  );
}
