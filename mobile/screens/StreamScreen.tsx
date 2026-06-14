import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useWebSocket } from '../services/websocket';
import { startPlayback, playChunk, stopPlayback } from '../services/audioPlayer';
import AudioPlayer from '../components/AudioPlayer';
import StreamViewer from '../components/StreamViewer';
import type { RootStackParamList } from '../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Stream'>;

const StreamScreen = ({ route, navigation }: Props) => {
  const { caregiverId, name, streamType } = route.params;
  const { sendMessage, subscribe } = useWebSocket('parent');

  const [mode, setMode] = useState<'audio' | 'video'>(streamType);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [frame, setFrame] = useState<string | null>(null);
  const [audioActive, setAudioActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Timer.
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Open the native player while listening; release it on leave / mode switch.
  useEffect(() => {
    if (mode !== 'audio') return;
    startPlayback();
    return () => {
      stopPlayback();
      setAudioActive(false);
    };
  }, [mode]);

  // Listen for stream id, incoming audio chunks and video frames.
  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === 'STREAM_STARTED') {
        setStreamId(msg.streamId);
      } else if (msg.type === 'AUDIO_CHUNK') {
        playChunk(msg.audio);
        setAudioActive(true);
      } else if (msg.type === 'VIDEO_FRAME') {
        setFrame(msg.frame);
      } else if (msg.type === 'STOP_STREAM') {
        navigation.goBack();
      } else if (msg.type === 'STREAM_ERROR') {
        Alert.alert('Stream error', msg.message || 'The caregiver is unavailable');
        navigation.goBack();
      }
    });
    return unsub;
  }, [subscribe, navigation]);

  const handleStartVideo = () => {
    setMode('video');
    sendMessage({ type: 'START_VIDEO_STREAM', caregiverId });
  };

  const handleStop = () => {
    if (streamId) sendMessage({ type: 'STOP_STREAM', streamId });
    navigation.goBack();
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.time}>{formatTime(elapsed)}</Text>
      </View>

      <View style={styles.body}>
        {mode === 'audio' ? (
          <AudioPlayer active={audioActive} />
        ) : (
          <StreamViewer frame={frame} />
        )}
      </View>

      <View style={styles.controls}>
        {mode === 'audio' && (
          <TouchableOpacity style={styles.videoButton} onPress={handleStartVideo}>
            <Text style={styles.controlText}>📹 See Camera</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
          <Text style={styles.controlText}>Stop</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  name: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 5 },
  time: { fontSize: 14, color: '#aaa' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  controls: {
    flexDirection: 'row',
    paddingBottom: 40,
    paddingHorizontal: 20,
    gap: 10,
  },
  videoButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  stopButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  controlText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});

export default StreamScreen;
