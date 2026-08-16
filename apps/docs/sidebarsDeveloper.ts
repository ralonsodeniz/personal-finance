import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  developerGuide: [
    "intro",
    {
      type: "category",
      label: "Architecture",
      items: ["architecture/workspace", "architecture/mobile"],
    },
    {
      type: "category",
      label: "Native readiness",
      items: ["native/authentication", "native/testing"],
    },
    "deferred-work",
  ],
};

export default sidebars;
