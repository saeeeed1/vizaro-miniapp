import Script from "next/script";

import { MiniAppProvider } from "@/components/providers/miniapp-provider";

import "@/app/globals.css";

export const metadata = {
  title: "Davomat Mini App",
  description: "Telegram Mini App for attendance, salary and penalty tracking."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <MiniAppProvider>{children}</MiniAppProvider>
      </body>
    </html>
  );
}
