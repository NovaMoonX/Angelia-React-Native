const { getMessaging, setBackgroundMessageHandler } = require('@react-native-firebase/messaging');

// Register a no-op background handler so React Native Firebase can process
// data/background messages without warning when the app is not in foreground.
setBackgroundMessageHandler(getMessaging(), async () => {
  return;
});

require('expo-router/entry');
