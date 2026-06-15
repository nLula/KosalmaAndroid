import React, { useLayoutEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNotes, getNoteRecords } from '../../services/notesContext';
import { NotesStackParams } from '../NotesScreen';
import SyncBar from '../../components/SyncBar';
import { C, S, R, SP } from '../../theme';

type Nav = NativeStackNavigationProp<NotesStackParams, 'NotesList'>;

export default function NotesListScreen() {
  const nav = useNavigation<Nav>();
  const { notes, loading, error, refresh, lastSync } = useNotes();

  const records = getNoteRecords(notes).sort((a, b) => {
    const ta = new Date(b.record.lastchanged || 0).getTime();
    const tb = new Date(a.record.lastchanged || 0).getTime();
    return ta - tb;
  });

  useLayoutEffect(() => {
    nav.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => nav.navigate('NoteEdit', {})}
        >
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      ),
    });
  }, [nav]);

  return (
    <View style={styles.container}>
      <SyncBar lastSync={lastSync} loading={loading} error={error} />
      <FlatList
        data={records}
        keyExtractor={({ id }) => id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} colors={[C.brand]} tintColor={C.brand} />
        }
        contentContainerStyle={styles.list}
        renderItem={({ item: { id, record } }) => (
          <TouchableOpacity style={styles.card} onPress={() => nav.navigate('NoteEdit', { id })} activeOpacity={0.75}>
            <View style={styles.cardLeft}>
              {record.color && record.color !== 'none' && (
                <View style={[styles.colorBar, { backgroundColor: `#${record.color}` }]} />
              )}
            </View>
            <View style={styles.mid}>
              <Text style={styles.header} numberOfLines={1}>
                {record.header?.replace(/^#+\s*/, '') || '(no title)'}
              </Text>
              <View style={styles.pills}>
                <View style={styles.tagPill}>
                  <Text style={styles.tagText}>{record.tag || '—'}</Text>
                </View>
                {record.project ? (
                  <Text style={styles.project} numberOfLines={1}>{record.project}</Text>
                ) : null}
              </View>
            </View>
            <Text style={styles.date}>
              {record.lastchanged
                ? new Date(record.lastchanged).toLocaleDateString([], { month: 'short', day: 'numeric' })
                : ''}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator style={{ marginTop: 60 }} color={C.brand} />
            : <Text style={styles.empty}>No notes yet.{'\n'}Tap + New to create one.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },
  list:       { padding: SP.sm, paddingBottom: SP.xl },
  addBtn:     { marginRight: 4, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: C.brandLight, borderRadius: R.sm },
  addBtnText: { color: C.brandDark, fontWeight: '700', fontSize: 14 },

  card:       { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.md, marginBottom: SP.sm, ...S.sm, overflow: 'hidden' },
  cardLeft:   { width: 6, alignSelf: 'stretch', backgroundColor: 'transparent' },
  colorBar:   { flex: 1, width: 6 },
  mid:        { flex: 1, paddingVertical: 12, paddingLeft: 10 },
  header:     { fontSize: 15, color: C.text, fontWeight: '600' },
  pills:      { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 6, flexWrap: 'wrap' },
  tagPill:    { backgroundColor: C.brandLight, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tagText:    { fontSize: 11, color: C.brand, fontWeight: '700' },
  project:    { fontSize: 11, color: C.textMuted, flexShrink: 1 },
  date:       { fontSize: 11, color: C.textHint, marginRight: 14 },
  empty:      { textAlign: 'center', marginTop: 80, color: C.textMuted, fontSize: 14, lineHeight: 22, paddingHorizontal: 40 },
});
