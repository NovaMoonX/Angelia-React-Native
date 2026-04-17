const fs = require('fs');
const path = require('path');

// Added during `prebuild` step
// Handle google-services.json from environment variable
// Can run `npm run env:android` to set this env variable for development builds
const googleServicesPath = process.env.GOOGLE_SERVICES_JSON;
// Create the google-services.json file
if (googleServicesPath && fs.existsSync(googleServicesPath)) {
  const targetPath = path.join(__dirname, 'google-services.json');
  fs.copyFileSync(googleServicesPath, targetPath);
  console.log('✅ Successfully copied google-services.json');
}

// TODO: Add GoogleService-Info.plist to the project env variables and update the path here

export default {
	expo: {
		name: 'Angelia',
		slug: 'angelia',
		version: '1.0.0',
		orientation: 'portrait',
		icon: './assets/images/icon.png',
		scheme: 'angelia',
		userInterfaceStyle: 'automatic',
		ios: {
			supportsTablet: true,
			bundleIdentifier: 'com.angelia.app',
			googleServicesFile: './GoogleService-Info.plist',
			infoPlist: {
				ITSAppUsesNonExemptEncryption: false,
			},
		},
		android: {
			adaptiveIcon: {
				backgroundColor: '#D97706',
				foregroundImage: './assets/images/icon.png',
			},
			package: 'com.angelia.app',
			softwareKeyboardLayoutMode: 'pan',
			googleServicesFile: './google-services.json',
		},
		web: {
			output: 'static',
			favicon: './assets/images/favicon.png',
		},
		plugins: [
			'expo-router',
			[
				'expo-splash-screen',
				{
					backgroundColor: '#D97706',
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
				},
			],
			'@react-native-firebase/app',
			'@react-native-firebase/auth',
			'@react-native-firebase/messaging',
			'@react-native-google-signin/google-signin',
			[
				'expo-build-properties',
				{
					ios: {
						useFrameworks: 'static',
					},
					android: {
						minSdkVersion: 24,
					},
				},
			],
			'expo-video',
			'expo-web-browser',
			[
				'react-native-vision-camera',
				{
					cameraPermissionText: 'Angelia needs camera access to let you capture photos and videos for posts.',
					enableMicrophonePermission: true,
					microphonePermissionText: 'Angelia needs microphone access to record audio with your videos.',
				},
			],
		],
		experiments: {
			typedRoutes: true,
		},
		extra: {
			router: {},
			eas: {
				projectId: '966178ad-a43f-425c-9ca2-b31b4a367d7c',
			},
		},
	},
};
