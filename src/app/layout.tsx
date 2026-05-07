import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SaveHub",
  description:
    "SaveHub organiza conteúdos salvos do YouTube, Instagram, TikTok, Twitter, WhatsApp, Telegram e web em uma biblioteca pessoal.",
  applicationName: "SaveHub",
  appleWebApp: {
    capable: true,
    title: "SaveHub",
    statusBarStyle: "default",
  },
  // PNG fallback for iOS home-screen install (Safari ignores manifest icons).
  icons: {
    apple: "/apple-touch-icon.png",
  },
  ...(process.env.NEXT_PUBLIC_FB_DOMAIN_VERIFICATION && {
    other: {
      "facebook-domain-verification":
        process.env.NEXT_PUBLIC_FB_DOMAIN_VERIFICATION,
    },
  }),
};

export const viewport: Viewport = {
  themeColor: "#0cf2a7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
