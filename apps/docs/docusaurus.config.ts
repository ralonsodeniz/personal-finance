import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import { themes as prismThemes } from "prism-react-renderer";

const docsSiteUrl = process.env.DOCS_SITE_URL;
const informationSpaces = [
  {
    label: "Developer guide",
    to: "/developers/intro",
  },
  {
    label: "User help",
    to: "/help/start-here",
  },
] as const;

const config: Config = {
  title: "Wayfinder documentation",
  tagline: "Architecture, implementation boundaries, and future product guidance",
  url: docsSiteUrl ?? "http://localhost:3000",
  baseUrl: process.env.DOCS_BASE_URL ?? "/",
  noIndex: !docsSiteUrl,
  onBrokenLinks: "throw",
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "throw",
    },
  },
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },
  presets: [
    [
      "classic",
      {
        docs: false,
        blog: false,
        sitemap: docsSiteUrl ? {} : false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],
  plugins: [
    [
      "@docusaurus/plugin-content-docs",
      {
        id: "developers",
        path: "docs-developer",
        routeBasePath: "developers",
        sidebarPath: "./sidebarsDeveloper.ts",
        showLastUpdateAuthor: false,
        showLastUpdateTime: false,
      },
    ],
    [
      "@docusaurus/plugin-content-docs",
      {
        id: "help",
        path: "docs-help",
        routeBasePath: "help",
        sidebarPath: "./sidebarsHelp.ts",
        showLastUpdateAuthor: false,
        showLastUpdateTime: false,
      },
    ],
  ],
  themeConfig: {
    navbar: {
      title: "Wayfinder / docs",
      items: informationSpaces.map(({ label, to }) => ({ label, to, position: "left" as const })),
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Information spaces",
          items: informationSpaces.map(({ label, to }) => ({ label, to })),
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Wayfinder`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
