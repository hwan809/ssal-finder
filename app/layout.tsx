import type { Metadata } from "next";
import localFont from "next/font/local";
import { S } from "@/lib/strings";
import "./globals.css";

const wantedSans = localFont({
  src: "../public/fonts/WantedSansVariable.woff2",
  variable: "--font-wanted",
  display: "swap",
});

export const metadata: Metadata = {
  title: S.APP_NAME,
  description: S.APP_DESC,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${wantedSans.variable} antialiased`}
        style={{
          fontFamily: "var(--font-wanted), system-ui, sans-serif",
          background: "var(--bg)",
          color: "var(--fg)",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
