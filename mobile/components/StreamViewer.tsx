import React from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';

interface StreamViewerProps {
  // Latest base64-encoded JPEG frame pushed from the caregiver device.
  frame: string | null;
}

/**
 * Renders the incoming video stream. The backend relays JPEG frames as base64
 * over WebSocket (type: VIDEO_FRAME); we draw the most recent one. For a smooth
 * real-time feed you would swap this for a WebRTC <RTCView> — see docs/SETUP.md.
 */
const StreamViewer = ({ frame }: StreamViewerProps) => {
  if (!frame) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <Image
      style={styles.image}
      source={{ uri: `data:image/jpeg;base64,${frame}` }}
      resizeMode="contain"
    />
  );
};

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  image: { flex: 1, backgroundColor: '#000' },
});

export default StreamViewer;
