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

// Handle GoogleService-Info.plist from environment variable
const googleServiceInfoPath = process.env.GOOGLE_SERVICE_INFO_PLIST;
// Create the GoogleService-Info.plist file
if (googleServiceInfoPath && fs.existsSync(googleServiceInfoPath)) {
	const targetPath = path.join(__dirname, 'GoogleService-Info.plist');
	fs.copyFileSync(googleServiceInfoPath, targetPath);
	console.log('✅ Successfully copied GoogleService-Info.plist');
}

export default {
	expo: {
		owner: 'novamoon',
		name: 'Angelia',
		slug: 'angelia',
		version: '1.0.7',
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
				NSLocationWhenInUseUsageDescription: 'Angelia uses your location to help you connect with people nearby.',
			},
		},
		android: {
			adaptiveIcon: {
				foregroundImage: './assets/images/android-icon-foreground.png',
				backgroundImage: './assets/images/android-icon-background.png',
				monochromeImage: './assets/images/android-icon-monochrome.png',
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
			'./plugins/withFirebaseMessagingColor',
			'expo-router',
			[
				'expo-audio',
				{
					microphonePermission: 'Allow $(PRODUCT_NAME) to access your microphone.',
				},
			],
			'@react-native-community/datetimepicker',
			[
				'expo-splash-screen',
				{
					backgroundColor: '#ffffff',
					image: './assets/images/splash-icon.png',
					imageWidth: 200,
				},
			],
			'@react-native-firebase/app',
			'./plugins/withFirebaseAppConfigure',
			'@react-native-firebase/auth',
			'@react-native-firebase/messaging',
			'@react-native-google-signin/google-signin',
			[
				'expo-notifications',
				{
					icon: './assets/images/icon.png',
					color: '#ffffff',
				},
			],
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
		build: {
			development: {
				developmentClient: true,
				distribution: 'internal',
				channel: 'development',
			},
			preview: {
				distribution: 'internal',
				channel: 'preview',
			},
			production: {
				channel: 'production',
			},
		},
		updates: {
			url: 'https://u.expo.dev/966178ad-a43f-425c-9ca2-b31b4a367d7c',
		},
		runtimeVersion: {
			policy: 'appVersion',
		},
	},
};
