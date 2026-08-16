const workspace = process.argv[2] ?? process.env.npm_package_name;

if (!workspace) {
  console.error("A workspace name is required.");
  process.exitCode = 1;
} else {
  console.log(`${workspace}: placeholder task`);
}
