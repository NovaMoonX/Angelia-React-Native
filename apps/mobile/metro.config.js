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
  /[/\\]\.expo[/\\].*/,
];

module.exports = config;
