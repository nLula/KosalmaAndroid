import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { C } from '../theme';

type Props = { lastSync: string | null; loading: boolean; error: string | null };

function formatTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

export default function SyncBar({ lastSync, loading, error }: Props) {
  if (error) {
    return (
      <View style={[styles.bar, styles.errorBar]}>
        <View style={[styles.dot, { backgroundColor: C.error }]} />
        <Text style={styles.errorText} numberOfLines={1}>⚠ {error}</Text>
      </View>
    );
  }
  return (
    <View style={styles.bar}>
      {loading
        ? <ActivityIndicator size="small" color={C.brand} style={{ marginRight: 2 }} />
        : <View style={[styles.dot, { backgroundColor: lastSync ? C.brand : C.textHint }]} />
      }
      <Text style={styles.text}>
        {loading ? 'Syncing…' : lastSync ? `Synced ${formatTime(lastSync)}` : 'Not synced'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar:       { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.surfaceAlt, borderBottomWidth: 0.5, borderBottomColor: C.borderLight },
  dot:       { width: 6, height: 6, borderRadius: 3 },
  text:      { fontSize: 11, color: C.textMuted, fontWeight: '500' },
  errorBar:  { backgroundColor: '#FFF5F5' },
  errorText: { fontSize: 11, color: C.error, fontWeight: '500', flex: 1 },
});
