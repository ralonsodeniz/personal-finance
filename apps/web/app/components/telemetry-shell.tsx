"use client";

import { useEffect } from "react";

import {
  createWebShellTelemetry,
  initializeWebShellTelemetryProviders,
} from "../lib/web-telemetry";

export function TelemetryShell() {
  useEffect(() => {
    createWebShellTelemetry({
      providers: initializeWebShellTelemetryProviders(),
    }).shellViewed();
  }, []);

  return null;
}
