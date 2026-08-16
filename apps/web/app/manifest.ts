import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wayfinder — personal finance",
    short_name: "Wayfinder",
    description: "A clear private starting point for personal and household finance.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#EDF2ED",
    theme_color: "#14252B",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/wayfinder-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/wayfinder-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/wayfinder-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
