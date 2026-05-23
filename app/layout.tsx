import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const jetbrainsMono = JetBrains_Mono({subsets:['latin'],variable:'--font-mono'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
};

export const metadata: Metadata = {
  title: "MusicMe",
  description: "Traduisez des sons en partitions et écoutez-les",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MusicMe",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-mono", jetbrainsMono.variable)}
    >
      <body className="flex min-h-full flex-col pb-[env(safe-area-inset-bottom)]">
        {children}
      </body>
    </html>
  );
}
