export const pwaConfig = {
  cacheOnNavigation: false,
  disable: process.env.NODE_ENV !== "production",
  options: {
    scope: "/",
    updateViaCache: "none",
  },
  register: process.env.NODE_ENV === "production",
  reloadOnOnline: false,
  swUrl: "/sw.js",
} as const;
