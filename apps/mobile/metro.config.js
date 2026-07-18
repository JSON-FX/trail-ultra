const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// NOTE: kept at the Metro/Expo default (false). pnpm does not hoist transitive
// dependencies into projectRoot/node_modules or workspaceRoot/node_modules —
// packages like @expo/metro-runtime only exist as symlinks inside their
// dependent's own node_modules (e.g. node_modules/.pnpm/expo-router@.../node_modules).
// Metro's hierarchical (upward) lookup is what finds those symlinks; disabling
// it breaks resolution in a pnpm workspace, so we leave it enabled and rely on
// nodeModulesPaths only as an addition, not a replacement.
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
