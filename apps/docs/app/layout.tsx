import { RootProvider } from "fumadocs-ui/provider/next";
import "./global.css";
import { Geist_Mono, Inter } from "next/font/google";

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
