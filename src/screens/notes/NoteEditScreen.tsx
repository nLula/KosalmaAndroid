import React, { useState, useLayoutEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Modal, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNotes, NoteRecord, getNoteRecords, getProjects, localISOString } from '../../services/notesContext';
import { stripMd } from '../../utils/stripMd';
import { NotesStackParams } from '../NotesScreen';
import { C, S, R, SP } from '../../theme';

type Nav   = NativeStackNavigationProp<NotesStackParams, 'NoteEdit'>;
type Route = RouteProp<NotesStackParams, 'NoteEdit'>;


export default function NoteEditScreen() {
  const nav   = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { notes, updateNote } = useNotes();

  const existingId = route.params?.id;
  const isNew      = !existingId;
  const existing   = existingId ? (notes[existingId] as NoteRecord) : null;

  const [header,      setHeader]      = useState(existing?.header?.replace(/^#+\s*/, '') ?? '');
  const [tag,         setTag]         = useState(existing?.tag ?? '');
  const [project,     setProject]     = useState(existing?.project ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [saving,      setSaving]      = useState(false);

  const [showTagPicker,     setShowTagPicker]     = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [newTagInput,       setNewTagInput]       = useState('');
  const [newProjectInput,   setNewProjectInput]   = useState('');

  const allTags = useMemo(() => {
    const set = new Set<string>();
    getNoteRecords(notes).forEach(({ record }) => { if (record.tag) set.add(record.tag); });
    return Array.from(set).sort();
  }, [notes]);

  const allProjects = useMemo(() =>
    getProjects(notes).filter(p => p !== '(no project)'),
  [notes]);

  useLayoutEffect(() => {
    nav.setOptions({
      title: isNew ? 'New Note' : 'Edit Note',
      headerRight: () => (
        <TouchableOpacity onPress={handleSave} style={styles.headerBtn} disabled={saving}>
          {saving
            ? <ActivityIndicator color={C.brand} size="small" />
            : <Text style={styles.headerBtnText}>Save</Text>
          }
        </TouchableOpacity>
      ),
    });
  }, [saving, header, tag, project, description, isNew]);

  async function handleSave() {
    if (!header.trim()) {
      Alert.alert('Title required', 'Please enter a note title.');
      return;
    }
    if (!tag.trim()) {
      Alert.alert('Tag required', 'Please select or create a tag.');
      setShowTagPicker(true);
      return;
    }
    setSaving(true);
    const now = localISOString();
    const id  = existingId ?? generateId(notes);
    const record: NoteRecord = {
      ...(existing ?? {} as any),
      header:      `# ${header.trim()}`,
      tag:         tag.trim(),
      project:     project.trim(),
      description,
      color:       existing?.color ?? 'none',
      status:      existing?.status ?? '',
      ishidden:    existing?.ishidden ?? '',
      created:     existing?.created ?? now,
      lastchanged: now,
    };
    try {
      await updateNote(id, record);
      nav.goBack();
    } catch (e: any) {
      Alert.alert('Save failed', e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    Alert.alert('Delete note', 'Move this note to trash?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await updateNote(existingId!, {
              ...existing!,
              ishidden: 'trash',
              lastchanged: localISOString(),
            });
            nav.goBack();
          } catch (e: any) {
            Alert.alert('Delete failed', e.message);
            setSaving(false);
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Note title"
          placeholderTextColor={C.textHint}
          value={header}
          onChangeText={setHeader}
          returnKeyType="next"
        />

        <Text style={styles.label}>
          Tag <Text style={styles.required}>*</Text>
        </Text>
        <TouchableOpacity
          style={[styles.picker, !tag && styles.pickerWarn]}
          onPress={() => setShowTagPicker(true)}
        >
          <Text style={tag ? styles.pickerValue : styles.pickerPlaceholder}>
            {tag || 'Select or create tag…'}
          </Text>
          <Text style={styles.pickerArrow}>›</Text>
        </TouchableOpacity>

        <Text style={styles.label}>
          Project <Text style={styles.optional}>(optional)</Text>
        </Text>
        <TouchableOpacity style={styles.picker} onPress={() => setShowProjectPicker(true)}>
          <Text style={project ? styles.pickerValue : styles.pickerPlaceholder}>
            {project || 'None'}
          </Text>
          <Text style={styles.pickerArrow}>›</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Write something…"
          placeholderTextColor={C.textHint}
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
        />

        {!isNew && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={saving}>
            <Text style={styles.deleteBtnText}>Move to trash</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <PickerModal
        visible={showTagPicker}
        title="Tag"
        items={allTags}
        selected={tag}
        newValue={newTagInput}
        onNewValueChange={setNewTagInput}
        onSelect={v => { setTag(v); setShowTagPicker(false); }}
        onAddNew={() => {
          const t = newTagInput.trim();
          if (t) { setTag(t); setNewTagInput(''); setShowTagPicker(false); }
        }}
        onClose={() => setShowTagPicker(false)}
        allowNone={false}
      />

      <PickerModal
        visible={showProjectPicker}
        title="Project"
        items={allProjects}
        selected={project}
        newValue={newProjectInput}
        onNewValueChange={setNewProjectInput}
        onSelect={v => { setProject(v); setShowProjectPicker(false); }}
        onAddNew={() => {
          const p = newProjectInput.trim();
          if (p) { setProject(p); setNewProjectInput(''); setShowProjectPicker(false); }
        }}
        onClose={() => setShowProjectPicker(false)}
        allowNone
        onSelectNone={() => { setProject(''); setShowProjectPicker(false); }}
      />
    </KeyboardAvoidingView>
  );
}

// ─── PickerModal ────────────────────────────────────────────────────────────

type PickerModalProps = {
  visible: boolean;
  title: string;
  items: string[];
  selected: string;
  newValue: string;
  onNewValueChange: (v: string) => void;
  onSelect: (v: string) => void;
  onAddNew: () => void;
  onClose: () => void;
  allowNone?: boolean;
  onSelectNone?: () => void;
};

function PickerModal({
  visible, title, items, selected, newValue, onNewValueChange,
  onSelect, onAddNew, onClose, allowNone, onSelectNone,
}: PickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.sheetClose}>✕</Text>
          </TouchableOpacity>
        </View>

        {allowNone && (
          <TouchableOpacity style={styles.sheetItem} onPress={onSelectNone}>
            <Text style={[styles.sheetItemText, { color: C.textMuted, fontStyle: 'italic' }]}>None</Text>
          </TouchableOpacity>
        )}

        <FlatList
          data={items}
          keyExtractor={i => i}
          style={{ maxHeight: 220 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.sheetItem} onPress={() => onSelect(item)}>
              <Text style={[styles.sheetItemText, item === selected && styles.sheetItemSelected]}>
                {item}
              </Text>
              {item === selected && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.sheetEmpty}>No existing {title.toLowerCase()}s</Text>
          }
        />

        <View style={styles.newRow}>
          <TextInput
            style={styles.newInput}
            placeholder={`New ${title.toLowerCase()}…`}
            placeholderTextColor={C.textHint}
            value={newValue}
            onChangeText={onNewValueChange}
            returnKeyType="done"
            onSubmitEditing={onAddNew}
          />
          <TouchableOpacity style={styles.addBtn} onPress={onAddNew}>
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

function generateId(notes: Record<string, any>): string {
  const used = new Set(
    Object.keys(notes)
      .filter(k => k.startsWith('Record'))
      .map(k => parseInt(k.replace('Record', ''), 10))
      .filter(n => !isNaN(n))
  );
  let id: number;
  do { id = Math.floor(Math.random() * 9000) + 1000; } while (used.has(id));
  return `Record${id}`;
}

// ─── styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.bg },
  content:          { padding: SP.md, paddingBottom: 48 },

  label:            { fontSize: 11, color: C.textMuted, fontWeight: '700', marginTop: 18, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  required:         { color: C.error },
  optional:         { color: C.textHint, fontWeight: '400', textTransform: 'none', letterSpacing: 0 },

  input:            { borderWidth: 1, borderColor: C.border, borderRadius: R.sm, padding: 10, fontSize: 15, color: C.text, backgroundColor: C.surface },
  picker:           { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 11, backgroundColor: C.surface },
  pickerWarn:       { borderColor: '#F5A7A7', backgroundColor: '#FFFAFA' },
  pickerValue:      { flex: 1, fontSize: 15, color: C.text },
  pickerPlaceholder:{ flex: 1, fontSize: 15, color: C.textHint },
  pickerArrow:      { fontSize: 18, color: C.textHint },

  textArea:         { borderWidth: 1, borderColor: C.border, borderRadius: R.sm, padding: 10, fontSize: 15, color: C.text, minHeight: 200, backgroundColor: C.surface },

  deleteBtn:        { marginTop: 32, padding: 14, borderRadius: R.sm, backgroundColor: '#FFF3F3', alignItems: 'center', borderWidth: 1, borderColor: '#F5A7A7' },
  deleteBtnText:    { color: C.error, fontWeight: '600', fontSize: 15 },

  headerBtn:        { marginRight: 4, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: C.brandLight, borderRadius: R.sm },
  headerBtnText:    { color: C.brandDark, fontWeight: '700', fontSize: 15 },

  overlay:          { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:            { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.surface, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, paddingBottom: 32 },
  sheetHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SP.md, borderBottomWidth: 0.5, borderBottomColor: C.borderLight },
  sheetTitle:       { fontSize: 16, fontWeight: '700', color: C.text },
  sheetClose:       { fontSize: 18, color: C.textHint },
  sheetItem:        { flexDirection: 'row', alignItems: 'center', padding: SP.md, borderBottomWidth: 0.5, borderBottomColor: C.borderLight },
  sheetItemText:    { flex: 1, fontSize: 15, color: C.text },
  sheetItemSelected:{ color: C.brand, fontWeight: '600' },
  checkmark:        { fontSize: 16, color: C.brand },
  sheetEmpty:       { padding: 24, textAlign: 'center', color: C.textMuted, fontSize: 13 },
  newRow:           { flexDirection: 'row', alignItems: 'center', padding: SP.sm, gap: 8, borderTopWidth: 0.5, borderTopColor: C.borderLight, marginTop: 4 },
  newInput:         { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: C.text, backgroundColor: C.surfaceAlt },
  addBtn:           { backgroundColor: C.brand, borderRadius: R.sm, paddingHorizontal: 16, paddingVertical: 9 },
  addBtnText:       { color: C.white, fontWeight: '700', fontSize: 14 },
});
