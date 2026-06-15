import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { User } from 'firebase/auth';
import { ref, get } from 'firebase/database';

import { auth, db } from './services/firebase';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import StreamScreen from './screens/StreamScreen';
import CaregiverScreen from './screens/CaregiverScreen';

type Role = 'parent' | 'caregiver';

export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
  Caregiver: undefined;
  Stream: {
    caregiverId: string;
    name: string;
    streamType: 'audio' | 'video';
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>('parent');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        try {
          const snap = await get(ref(db, `users/${u.uid}`));
          setRole(snap.val()?.role === 'caregiver' ? 'caregiver' : 'parent');
        } catch {
          setRole('parent');
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          role === 'caregiver' ? (
            <Stack.Screen name="Caregiver" component={CaregiverScreen} />
          ) : (
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen
                name="Stream"
                component={StreamScreen}
                options={{ presentation: 'modal' }}
              />
            </>
          )
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
