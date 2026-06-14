import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

interface AudioPlayerProps {
  // Pulses while audio chunks are flowing in.
  active?: boolean;
}

/**
 * Lightweight "now listening" visualiser. Actual audio playback of the incoming
 * base64 chunks is wired up at the native layer (see docs/SETUP.md — Audio
 * pipeline). This component is the visual feedback the parent sees while a
 * stream is live.
 */
const AudioPlayer = ({ active = true }: AudioPlayerProps) => {
  const scale = useRef(new Animated.Value(1)).current;
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, scale]);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.pulse, { transform: [{ scale }] }]}>
        <Text style={styles.icon}>🔊</Text>
      </Animated.View>
      <Text style={styles.label}>
        {active ? 'Listening…' : 'Connecting…'} · {seconds}s
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  pulse: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(0,122,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 56 },
  label: { color: '#fff', marginTop: 24, fontSize: 16 },
});

export default AudioPlayer;
