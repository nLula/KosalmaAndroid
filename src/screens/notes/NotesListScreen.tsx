import React, { useLayoutEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNotes, getNoteRecords } from '../../services/notesContext';
import { NotesStackParams } from '../NotesScreen';
import SyncBar from '../../components/SyncBar';
import { useColors } from '../../services/themeContext';
import { S, R, SP, ColorsType } from '../../theme';

type Nav = NativeStackNavigationProp<NotesStackParams, 'NotesList'>;

function tagBadgeStyle(color: string | undefined, C: ColorsType): { bg: string; border: string; text: string } {
  if (!color || color === 'none' || color === 'FFFFFF') {
    return { bg: C.surfaceAlt, border: C.border, text: C.textSub };
  }
  const isLight = color === 'FFF200';
  return { bg: `#${color}`, border: `#${color}`, text: isLight ? C.text : C.white };
}

export default function NotesListScreen() {
  const nav = useNavigation<Nav>();
  const { notes, loading, error, refresh, lastSync } = useNotes();

  const C = useColors();
  const styles = React.useMemo(() => makeStyles(C), [C]);

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
  }, [nav, styles]);

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
        renderItem={({ item: { id, record } }) => {
          const tagLabel = (record.tag || '—').slice(0, 4).toUpperCase();
          const { bg, border, text } = tagBadgeStyle(record.color, C);
          const sub = [record.tag, record.project].filter(Boolean).join(' · ');
          return (
            <TouchableOpacity style={styles.card} onPress={() => nav.navigate('NoteEdit', { id })} activeOpacity={0.75}>
              <View style={[styles.badge, { backgroundColor: bg, borderColor: border }]}>
                <Text style={[styles.badgeText, { color: text }]}>{tagLabel}</Text>
              </View>
              <View style={styles.mid}>
                <Text style={styles.title} numberOfLines={1}>
                  {record.header?.replace(/^#+\s*/, '') || '(no title)'}
                </Text>
                {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}
              </View>
              <Text style={styles.date}>
                {record.lastchanged
                  ? new Date(record.lastchanged).toLocaleDateString([], { month: 'short', day: 'numeric' })
                  : ''}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator style={{ marginTop: 60 }} color={C.brand} />
            : <Text style={styles.empty}>No notes yet.{'\n'}Tap + New to create one.</Text>
        }
      />
    </View>
  );
}

function makeStyles(C: ColorsType) {
  return StyleSheet.create({
    container:  { flex: 1, backgroundColor: C.bg },
    list:       { padding: SP.sm, paddingBottom: SP.xl },
    addBtn:     { marginRight: 0, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.surface, borderRadius: R.sm, borderWidth: 1.5, borderColor: C.brand },
    addBtnText: { color: C.text, fontWeight: '600', fontSize: 13 },

    card:       { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.md, marginBottom: SP.sm, paddingHorizontal: SP.md, paddingVertical: SP.sm + 2, ...S.sm },
    badge:      { width: 36, height: 36, borderRadius: R.xs, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    badgeText:  { fontSize: 9, fontWeight: '700', color: C.textSub, letterSpacing: 0.5 },
    mid:        { flex: 1 },
    title:      { fontSize: 14, color: C.text, fontWeight: '500' },
    sub:        { fontSize: 11, color: C.textMuted, marginTop: 2 },
    date:       { fontSize: 11, color: C.textHint, marginLeft: 8 },
    empty:      { textAlign: 'center', marginTop: 80, color: C.textMuted, fontSize: 14, lineHeight: 22, paddingHorizontal: 40 },
  });
}
