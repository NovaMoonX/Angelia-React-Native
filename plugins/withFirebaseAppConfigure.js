const { withDangerousMod, IOSConfig, WarningAggregator } = require('@expo/config-plugins');
const fs = require('fs');

/**
 * The @react-native-firebase/app Expo plugin's Swift handler looks for
 * `self.moduleName = "..."` as its insertion anchor — a pattern from the old
 * Expo ObjC AppDelegate. The new ExpoAppDelegate (Swift) has no such line, so
 * the regex never matches and FirebaseApp.configure() is silently skipped.
 *
 * This plugin runs after @react-native-firebase/app and inserts
 * `FirebaseApp.configure()` using the correct anchor for the new Expo Swift
 * AppDelegate format (`let delegate = ReactNativeDelegate()`).
 */
const withFirebaseAppConfigure = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const fileInfo = IOSConfig.Paths.getAppDelegate(config.modRequest.projectRoot);

      if (fileInfo.language !== 'swift') {
        return config;
      }

      let contents = fileInfo.contents;

      // Already inserted (idempotent)
      if (contents.includes('FirebaseApp.configure()')) {
        return config;
      }

      // Ensure FirebaseCore is imported
      if (!contents.includes('import FirebaseCore')) {
        contents = contents.replace(/^(import Expo)/m, '$1\nimport FirebaseCore');
      }

      // Insert FirebaseApp.configure() as the first statement in
      // didFinishLaunchingWithOptions — before `let delegate = ReactNativeDelegate()`
      const patched = contents.replace(
        /^(\s+)(let delegate = ReactNativeDelegate\(\))/m,
        '$1FirebaseApp.configure()\n$1$2',
      );

      if (patched === contents) {
        WarningAggregator.addWarningIOS(
          'withFirebaseAppConfigure',
          'Could not find insertion point for FirebaseApp.configure() in AppDelegate.swift. ' +
            'Firebase may not be initialized on iOS.',
        );
        return config;
      }

      await fs.promises.writeFile(fileInfo.path, patched);

      return config;
    },
  ]);
};

module.exports = withFirebaseAppConfigure;
