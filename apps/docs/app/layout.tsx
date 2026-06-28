import { RootProvider } from "fumadocs-ui/provider/next";
import "./global.css";
import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { appName } from "@/lib/shared";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://render-sdk.remocn.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: appName,
    template: `%s | ${appName}`,
  },
  openGraph: {
    type: "website",
    siteName: appName,
    url: siteUrl,
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og.png"],
  },
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html
      className={`${inter.variable} ${geistMono.variable} ${inter.className}`}
      lang="en"
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
