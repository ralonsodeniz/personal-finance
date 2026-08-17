import { SerwistProvider } from "@serwist/turbopack/react";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "@personal-finance/design-tokens/tokens.css";
import "./globals.css";

import { TelemetryShell } from "./components/telemetry-shell";
import { pwaConfig } from "./lib/pwa";

export const metadata: Metadata = {
  applicationName: "Wayfinder",
  description: "A clear private starting point for personal and household finance.",
  icons: {
    icon: "/icons/wayfinder-mark.svg",
  },
  title: {
    default: "Wayfinder — find the thread",
    template: "%s — Wayfinder",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  initialScale: 1,
  themeColor: "#14252B",
  width: "device-width",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TelemetryShell />
        <SerwistProvider
          cacheOnNavigation={pwaConfig.cacheOnNavigation}
          disable={pwaConfig.disable}
          options={pwaConfig.options}
          register={pwaConfig.register}
          reloadOnOnline={pwaConfig.reloadOnOnline}
          swUrl={pwaConfig.swUrl}
        >
          {children}
        </SerwistProvider>
      </body>
    </html>
  );
}
