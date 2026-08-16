/// <reference lib="esnext" />
/// <reference lib="webworker" />

import {
  NetworkOnly,
  Serwist,
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const isProtectedApiRequest = ({ sameOrigin, url }: { sameOrigin: boolean; url: URL }) =>
  sameOrigin && url.pathname.startsWith("/api/");

const isNextDataRequest = ({ sameOrigin, url }: { sameOrigin: boolean; url: URL }) =>
  sameOrigin && url.pathname.startsWith("/_next/data/");

const isRscOrPrefetchRequest = ({
  request,
  sameOrigin,
}: {
  request: Request;
  sameOrigin: boolean;
}) =>
  sameOrigin &&
  request.method === "GET" &&
  (request.headers.has("RSC") || request.headers.has("Next-Router-Prefetch"));

const isServerActionRequest = ({
  request,
  sameOrigin,
}: {
  request: Request;
  sameOrigin: boolean;
}) => sameOrigin && request.method === "POST" && request.headers.has("Next-Action");

const isDocumentRequest = ({ request, sameOrigin }: { request: Request; sameOrigin: boolean }) =>
  sameOrigin && request.mode === "navigate";

const protectedApiRoutes: RuntimeCaching[] = (
  ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"] as const
).map((method) => ({
  matcher: isProtectedApiRequest,
  method,
  handler: new NetworkOnly(),
}));

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  runtimeCaching: [
    ...protectedApiRoutes,
    {
      matcher: isNextDataRequest,
      method: "GET",
      handler: new NetworkOnly(),
    },
    {
      matcher: isRscOrPrefetchRequest,
      method: "GET",
      handler: new NetworkOnly(),
    },
    {
      matcher: isServerActionRequest,
      method: "POST",
      handler: new NetworkOnly(),
    },
    {
      matcher: isDocumentRequest,
      method: "GET",
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: [
      {
        matcher: ({ request }) => request.mode === "navigate",
        url: "/~offline",
      },
    ],
  },
});

serwist.addEventListeners();
