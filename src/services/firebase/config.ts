import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';
import { getStorage } from '@react-native-firebase/storage';

// @react-native-firebase initializes from google-services.json / GoogleService-Info.plist
// automatically — no JS-side config object is needed.

export { getApp, getAuth, getFirestore, getStorage };
