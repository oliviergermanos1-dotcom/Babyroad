import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { auth, database } from '../services/firebase';
import { useWebSocket } from '../services/websocket';
import { colors, radius, shadow } from '../theme';
import type { RootStackParamList } from '../App';

interface Contact {
  id: string;
  name: string;
  phone: string;
  isOnline: boolean;
}

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const HomeScreen = ({ navigation }: Props) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const { isConnected, sendMessage, subscribe } = useWebSocket('parent');

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      const snapshot = await database()
        .ref('users')
        .orderByChild('role')
        .equalTo('caregiver')
        .once('value');
      const list: Contact[] = [];
      snapshot.forEach((child) => {
        const v = child.val();
        list.push({
          id: child.key as string,
          name: v.name,
          phone: v.phone,
          isOnline: false,
        });
        return false;
      });
      setContacts(list);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de charger les contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === 'USER_STATUS') {
        setContacts((prev) =>
          prev.map((c) =>
            c.id === msg.userId ? { ...c, isOnline: msg.isOnline } : c
          )
        );
      } else if (msg.type === 'CONTACTS') {
        setContacts(msg.contacts);
      }
    });
    return unsub;
  }, [subscribe]);

  useEffect(() => {
    if (isConnected) sendMessage({ type: 'GET_CONTACTS' });
  }, [isConnected, sendMessage]);

  const handleStartAudio = (caregiverId: string, name: string) => {
    if (!auth().currentUser) return;
    sendMessage({ type: 'START_AUDIO_STREAM', caregiverId });
    navigation.navigate('Stream', { caregiverId, name, streamType: 'audio' });
  };

  const renderContact = ({ item }: { item: Contact }) => (
    <View style={styles.contactCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(item.name || '?').charAt(0).toUpperCase()}
        </Text>
        {item.isOnline && <View style={styles.onlineDot} />}
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.contactPhone}>{item.phone}</Text>
        <Text
          style={[
            styles.statusText,
            { color: item.isOnline ? colors.green : colors.muted },
          ]}
        >
          {item.isOnline ? '● En ligne' : '○ Hors ligne'}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.listenButton, !item.isOnline && styles.buttonDisabled]}
        onPress={() => handleStartAudio(item.id, item.name)}
        disabled={!item.isOnline}
        activeOpacity={0.85}
      >
        <Text style={styles.listenText}>Écouter</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image
          source={require('../assets/logo_clean.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>BabyPhone CIV</Text>
          <Text style={styles.headerSub}>
            {isConnected ? 'Connecté' : 'Connexion…'}
          </Text>
        </View>
        {isConnected && <View style={styles.connDot} />}
      </View>

      <Text style={styles.sectionTitle}>Mes appareils bébé</Text>

      {contacts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>👶</Text>
          <Text style={styles.emptyText}>Aucun appareil ajouté</Text>
          <Text style={styles.emptyHint}>
            Les appareils « bébé » apparaîtront ici une fois ajoutés.
          </Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          renderItem={renderContact}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}

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
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 50 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  headerLogo: { width: 46, height: 46 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.greenDark },
  headerSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  connDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.green },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted,
    paddingHorizontal: 20,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  contactCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...shadow,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: colors.green },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: colors.card,
  },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 16, fontWeight: '700', color: colors.text },
  contactPhone: { fontSize: 13, color: colors.muted, marginVertical: 2 },
  statusText: { fontSize: 12, fontWeight: '600' },
  listenButton: {
    backgroundColor: colors.orange,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
  },
  buttonDisabled: { opacity: 0.4 },
  listenText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  emptyEmoji: { fontSize: 54, marginBottom: 12 },
  emptyText: { fontSize: 17, fontWeight: '700', color: colors.text },
  emptyHint: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
  },
  logout: {
    margin: 20,
    paddingVertical: 14,
    backgroundColor: colors.greenLight,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  logoutText: { color: colors.greenDark, fontWeight: '700' },
});

export default HomeScreen;
