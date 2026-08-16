import { createSerwistRoute } from "@serwist/turbopack";

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    additionalPrecacheEntries: [
      {
        revision: process.env.VERCEL_GIT_COMMIT_SHA ?? "wayfinder-shell-v1",
        url: "/~offline",
      },
    ],
    swSrc: "app/sw.ts",
    useNativeEsbuild: true,
  },
);
