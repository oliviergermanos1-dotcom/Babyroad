import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { collection, query, where, getDocs } from 'firebase/firestore';

import { auth, db } from '../services/firebase';
import { useWebSocket } from '../services/websocket';
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
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'caregiver')
      );
      const snapshot = await getDocs(q);
      setContacts(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
          phone: doc.data().phone,
          isOnline: false,
        }))
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Keep online dots in sync with server USER_STATUS broadcasts.
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
    if (!auth.currentUser) return;
    sendMessage({ type: 'START_AUDIO_STREAM', caregiverId });
    navigation.navigate('Stream', { caregiverId, name, streamType: 'audio' });
  };

  const renderContact = ({ item }: { item: Contact }) => (
    <View style={styles.contactCard}>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.contactPhone}>{item.phone}</Text>
        <View style={styles.statusBadge}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: item.isOnline ? '#4CAF50' : '#999' },
            ]}
          />
          <Text style={styles.statusText}>
            {item.isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.listenButton, !item.isOnline && styles.buttonDisabled]}
        onPress={() => handleStartAudio(item.id, item.name)}
        disabled={!item.isOnline}
      >
        <Text style={styles.buttonText}>Listen</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>BabyPhone</Text>
        {/* Connection state: grey dot when running/connected, no colour
            (hollow) when disconnected. */}
        <View
          style={[
            styles.connDot,
            isConnected ? styles.connDotOn : styles.connDotOff,
          ]}
        />
      </View>
      <Text style={styles.subheader}>
        {isConnected ? 'Listen to your caregivers' : 'Disconnected'}
      </Text>

      {contacts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No caregivers added yet</Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          renderItem={renderContact}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => auth.signOut()}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 60 },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  connDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 10,
  },
  // Running / connected → grey fill.
  connDotOn: {
    backgroundColor: '#9e9e9e',
    borderWidth: 0,
  },
  // Disconnected → no colour (hollow outline only).
  connDotOff: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#cccccc',
  },
  subheader: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  contactCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  contactPhone: { fontSize: 14, color: '#999', marginBottom: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, color: '#666' },
  listenButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#999' },
  logoutButton: {
    margin: 20,
    paddingVertical: 12,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: { color: '#fff', fontWeight: '600' },
});

export default HomeScreen;
