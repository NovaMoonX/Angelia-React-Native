const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Prevent Metro's file watcher from reacting to writes inside .expo/.
// In particular, .expo/xcodebuild.log is written continuously during iOS
// builds and — with no exclusion — triggers a Fast Refresh on every connected
// device (iOS + Android) even though no source file has changed.
const existingBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : config.resolver.blockList
  ? [config.resolver.blockList]
  : [];

config.resolver.blockList = [
  ...existingBlockList,
  // Ignore .expo/ internal files (e.g. xcodebuild.log written during iOS builds)
  /[/\\]\.expo[/\\].*/,
  // Ignore everything in the monorepo that isn't apps/mobile — e.g. apps/web.
  // Metro is rooted at apps/mobile/ so changes outside this directory should
  // never trigger a Fast Refresh rebuild.
  /[/\\]apps[/\\](?!mobile[/\\]).*/,
];

module.exports = config;
