import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';

import { auth } from '../services/firebase';
import { useWS } from '../services/ws';
import { useCaregiverStream } from '../services/useCaregiverStream';
import { colors, radius, shadow } from '../theme';

/**
 * Screen for the monitored (baby-side) device. Stays connected; when a parent
 * starts listening, the native mic bridge streams audio. A clear LIVE indicator
 * keeps the device user aware the mic is active.
 */
const CaregiverScreen = () => {
  const { isConnected, sendMessage, subscribe } = useWS();
  const [streaming, setStreaming] = useState(false);

  useCaregiverStream({ subscribe, sendMessage, onActiveChange: setStreaming });

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/logo_clean.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>BabyPhone CIV</Text>
      <Text style={styles.subtitle}>Appareil bébé</Text>

      <View
        style={[
          styles.statusCard,
          streaming ? styles.live : styles.idle,
        ]}
      >
        <Text style={styles.statusEmoji}>{streaming ? '🔴' : '🟢'}</Text>
        <Text
          style={[
            styles.statusText,
            { color: streaming ? colors.danger : colors.green },
          ]}
        >
          {streaming
            ? 'EN DIRECT — un parent écoute'
            : isConnected
            ? 'Prêt · en veille'
            : 'Connexion…'}
        </Text>
      </View>

      <Text style={styles.note}>
        Cet appareil partage son micro (et sa caméra si demandé) quand un parent
        se connecte. Une notification reste visible tant que le micro est actif.
      </Text>

      <TouchableOpacity
        style={styles.logout}
        onPress={() => auth().signOut()}
        activeOpacity={0.85}
      >
        <Text style={styles.logoutText}>Déconnexion</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    paddingTop: 70,
    paddingHorizontal: 24,
  },
  logo: { width: 120, height: 120, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '800', color: colors.greenDark },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: 30 },
  statusCard: {
    width: '100%',
    borderRadius: radius.lg,
    padding: 28,
    alignItems: 'center',
    marginBottom: 22,
    ...shadow,
  },
  live: { backgroundColor: '#FDECEC' },
  idle: { backgroundColor: colors.greenLight },
  statusEmoji: { fontSize: 44, marginBottom: 12 },
  statusText: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  note: { fontSize: 13, color: colors.muted, lineHeight: 20, textAlign: 'center' },
  logout: {
    marginTop: 'auto',
    marginBottom: 40,
    paddingVertical: 14,
    paddingHorizontal: 40,
    backgroundColor: colors.greenLight,
    borderRadius: radius.md,
  },
  logoutText: { color: colors.greenDark, fontWeight: '700' },
});

export default CaregiverScreen;
