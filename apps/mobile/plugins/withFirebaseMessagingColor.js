const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Fixes a manifest merger conflict between expo-notifications and
 * @react-native-firebase/messaging where both declare:
 *   com.google.firebase.messaging.default_notification_color
 *
 * Adds tools:replace="android:resource" to the meta-data element so the
 * manifest merger uses our value and ignores Firebase's.
 */
const withFirebaseMessagingColor = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Ensure xmlns:tools is declared on the root manifest element
    manifest.$ = {
      ...manifest.$,
      'xmlns:tools': 'http://schemas.android.com/tools',
    };

    const mainApp = manifest.application?.[0];
    if (!mainApp) return config;

    const metaData = mainApp['meta-data'] || [];

    const colorMeta = metaData.find(
      (m) =>
        m.$['android:name'] ===
        'com.google.firebase.messaging.default_notification_color'
    );

    if (colorMeta) {
      colorMeta.$['tools:replace'] = 'android:resource';
    }

    mainApp['meta-data'] = metaData;

    return config;
  });
};

module.exports = withFirebaseMessagingColor;
