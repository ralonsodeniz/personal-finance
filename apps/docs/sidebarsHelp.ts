import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  userHelp: [
    "start-here",
    {
      type: "category",
      label: "Getting oriented",
      items: ["getting-oriented/documentation-status"],
    },
  ],
};

export default sidebars;
