import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { getMessages } from "@/i18n/messages";
import { resolveRequestLocale } from "@/lib/server/request-locale";
import "./globals.css";

export const metadata: Metadata = {
  title: "Muses Canvas OSS",
  description: "Standalone infinite canvas extracted from Muses.",
  icons: {
    icon: "/logo.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#151515" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await resolveRequestLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NextIntlClientProvider locale={locale} messages={getMessages(locale)}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
