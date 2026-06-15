import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';

// @react-native-firebase auto-initializes from the native config files
// (android/app/google-services.json and iOS GoogleService-Info.plist), so no
// JS config object is needed here. See docs/SETUP.md to add google-services.json.
//
// Usage: auth().currentUser, auth().signInWithPhoneNumber(...),
//        database().ref('users/<uid>')...
export { auth, database };
