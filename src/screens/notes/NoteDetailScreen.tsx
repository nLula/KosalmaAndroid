import React, { useLayoutEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNotes, NoteRecord } from '../../services/notesContext';
import { NotesStackParams } from '../NotesScreen';
import { useColors } from '../../services/themeContext';
import { R, SP, ColorsType } from '../../theme';

type Route = RouteProp<NotesStackParams, 'NoteDetail'>;
type Nav   = NativeStackNavigationProp<NotesStackParams, 'NoteDetail'>;

export default function NoteDetailScreen() {
  const route = useRoute<Route>();
  const nav   = useNavigation<Nav>();
  const { id } = route.params;
  const { notes, updateNote } = useNotes();

  const C = useColors();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const record = notes[id] as NoteRecord;
  const [editing, setEditing]       = useState(false);
  const [description, setDescription] = useState(record?.description ?? '');
  const [saving, setSaving]         = useState(false);

  useLayoutEffect(() => {
    nav.setOptions({
      title: record?.header?.replace(/^#+\s*/, '') ?? 'Note',
      headerRight: () => (
        editing ? (
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn} disabled={saving}>
            {saving
              ? <ActivityIndicator color={C.brand} size="small" />
              : <Text style={styles.headerBtnText}>Save</Text>
            }
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setEditing(true)} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Edit</Text>
          </TouchableOpacity>
        )
      ),
    });
  }, [editing, saving, description, styles]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateNote(id, { ...record, description });
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Save failed', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!record) {
    return <View style={styles.center}><Text style={styles.body}>Note not found</Text></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.meta}>
        <Text style={styles.metaText}>Tag: {record.tag}</Text>
        {record.project ? <Text style={styles.metaText}>Project: {record.project}</Text> : null}
        {record.createdForDate ? (
          <Text style={styles.metaDate}>📅 {parseDate(record.createdForDate)}</Text>
        ) : null}
        <Text style={styles.metaText}>
          Changed: {record.lastchanged ? new Date(record.lastchanged).toLocaleDateString() : '—'}
        </Text>
      </View>

      {editing ? (
        <TextInput
          style={styles.editor}
          multiline
          value={description}
          onChangeText={setDescription}
          autoFocus
          textAlignVertical="top"
        />
      ) : (
        <Text style={styles.body}>{description}</Text>
      )}
    </ScrollView>
  );
}

function parseDate(raw: string): string {
  const match = raw.match(/:(\d{8});/);
  if (!match) return raw;
  const d = match[1];
  return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
}

function makeStyles(C: ColorsType) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: C.bg },
    content:      { padding: SP.md, paddingBottom: 40 },
    center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
    meta:         { backgroundColor: C.surfaceAlt, borderRadius: R.sm, padding: 12, marginBottom: 16, gap: 4 },
    metaText:     { fontSize: 12, color: C.textSub },
    metaDate:     { fontSize: 12, color: C.brand, fontWeight: '600' },
    body:         { fontSize: 15, color: C.text, lineHeight: 22 },
    editor:       { fontSize: 15, color: C.text, lineHeight: 22, minHeight: 300, borderWidth: 1, borderColor: C.border, borderRadius: R.sm, padding: 10, backgroundColor: C.surface },
    headerBtn:    { marginRight: 12, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.surface, borderRadius: R.sm, borderWidth: 1.5, borderColor: C.brand },
    headerBtnText:{ color: C.text, fontWeight: '700', fontSize: 15 },
  });
}
