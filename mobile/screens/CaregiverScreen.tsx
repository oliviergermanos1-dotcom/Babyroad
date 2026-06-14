import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { auth } from '../services/firebase';
import { useWebSocket } from '../services/websocket';
import { useCaregiverStream } from '../services/useCaregiverStream';

/**
 * Screen for the monitored (caregiver) device. It stays connected and, when a
 * parent starts listening, the native mic bridge streams audio. A clear "live"
 * indicator is shown — the device user always knows when the mic is active.
 */
const CaregiverScreen = () => {
  const { isConnected, sendMessage, subscribe } = useWebSocket('caregiver');
  const [streaming, setStreaming] = useState(false);

  useCaregiverStream({ subscribe, sendMessage, onActiveChange: setStreaming });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>BabyPhone</Text>
      <Text style={styles.subtitle}>Monitoring device</Text>

      <View
        style={[
          styles.statusCard,
          streaming ? styles.statusLive : styles.statusIdle,
        ]}
      >
        <Text style={styles.statusEmoji}>{streaming ? '🔴' : '🟢'}</Text>
        <Text style={styles.statusText}>
          {streaming
            ? 'LIVE — a parent is connected (mic / camera)'
            : isConnected
            ? 'Ready · standing by'
            : 'Connecting…'}
        </Text>
      </View>

      <Text style={styles.note}>
        This device shares its microphone (and camera, if requested) when a
        parent connects. A notification stays visible while the mic is active.
      </Text>

      <TouchableOpacity style={styles.logout} onPress={() => auth.signOut()}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  title: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 32 },
  statusCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  statusLive: { backgroundColor: '#ffe5e5' },
  statusIdle: { backgroundColor: '#e6f4ea' },
  statusEmoji: { fontSize: 40, marginBottom: 12 },
  statusText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  note: { fontSize: 13, color: '#777', lineHeight: 20 },
  logout: {
    marginTop: 'auto',
    marginBottom: 40,
    paddingVertical: 12,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: { color: '#fff', fontWeight: '600' },
});

export default CaregiverScreen;
