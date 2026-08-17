"use client";

import { useEffect } from "react";

import { createWebShellTelemetry, getWebShellTelemetryProviders } from "../lib/web-telemetry";

export function TelemetryShell() {
  useEffect(() => {
    createWebShellTelemetry({ providers: getWebShellTelemetryProviders() }).shellViewed();
  }, []);

  return null;
}
