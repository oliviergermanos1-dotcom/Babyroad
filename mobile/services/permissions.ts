import { Platform, PermissionsAndroid } from 'react-native';

/**
 * Request the runtime permissions BabyPhone needs on the caregiver device:
 * microphone (always) and camera (for the optional video stream).
 * Returns true only if every requested permission is granted.
 */
export async function requestStreamingPermissions(
  withVideo = false
): Promise<boolean> {
  if (Platform.OS !== 'android') {
    // iOS prompts on first use via Info.plist usage descriptions.
    return true;
  }

  const wanted = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (withVideo) {
    wanted.push(PermissionsAndroid.PERMISSIONS.CAMERA);
  }

  try {
    const result = await PermissionsAndroid.requestMultiple(wanted);
    return wanted.every(
      (p) => result[p] === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch (e) {
    console.warn('[permissions] request failed', e);
    return false;
  }
}
