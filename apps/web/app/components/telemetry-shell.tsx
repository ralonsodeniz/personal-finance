"use client";

import { useEffect } from "react";

import {
  createWebShellTelemetry,
  getWebShellTelemetryProviders,
  initializeWebShellTelemetryProviders,
} from "../lib/web-telemetry";

export function TelemetryShell() {
  initializeWebShellTelemetryProviders();

  useEffect(() => {
    createWebShellTelemetry({ providers: getWebShellTelemetryProviders() }).shellViewed();
  }, []);

  return null;
}
