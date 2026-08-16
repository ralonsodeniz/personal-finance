export default {
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/.turbo/**", "**/dist/**", "**/build/**"],
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,tsx}"],
    passWithNoTests: true,
  },
};
