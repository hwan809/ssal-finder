import type { Metadata } from "next";
import localFont from "next/font/local";
import { S } from "@/lib/strings";
import "./globals.css";

const pretendard = localFont({
  src: "../public/fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
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
        className={`${pretendard.variable} font-[family-name:var(--font-pretendard),system-ui,sans-serif] antialiased bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100 min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
