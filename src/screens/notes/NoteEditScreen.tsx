import React, { useState, useLayoutEffect, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Modal, FlatList, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker    from 'expo-image-picker';
import * as FileSystem     from 'expo-file-system/legacy';
import { useNotes, NoteRecord, getNoteRecords, localISOString } from '../../services/notesContext';
import { loadConfig } from '../../services/storage';
import { uploadFile, getFileSha, uploadAttachment, getAttachmentSha } from '../../services/githubApi';
import { AppConfig } from '../../config/defaults';
import { NotesStackParams } from '../NotesScreen';
import { useColors } from '../../services/themeContext';
import { S, R, SP, ColorsType } from '../../theme';

type Nav   = NativeStackNavigationProp<NotesStackParams, 'NoteEdit'>;
type Route = RouteProp<NotesStackParams, 'NoteEdit'>;

// ─── attachment types & helpers ──────────────────────────────────────────────

type AttachItem =
  | { kind: 'addedFile'; name: string; imgType: 'image' | 'file'; localUri?: string; base64?: string; isNew?: boolean }
  | { kind: 'pcImage';   token: string };

const SIZE_LIMIT = 48 * 1024 * 1024;
const IMG_EXTS   = new Set(['jpg','jpeg','png','gif','webp','bmp','heic','heif']);

function isImg(name: string): boolean {
  return IMG_EXTS.has(name.split('.').pop()?.toLowerCase() ?? '');
}

function fileBadge(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (IMG_EXTS.has(ext))                         return 'IMG';
  if (ext === 'pdf')                             return 'PDF';
  if (['dwg','dxf','dwl'].includes(ext))         return 'DWG';
  if (['zip','rar','7z'].includes(ext))          return 'ZIP';
  if (['txt','csv','md'].includes(ext))          return 'TXT';
  return ext.toUpperCase().slice(0, 3) || 'FILE';
}

function parseDesc(raw: string): { text: string; items: AttachItem[] } {
  const items: AttachItem[] = [];
  const text = raw
    .replace(/\[\[attachment_png_([^\]]+)\]\]/g, (_, rest) => {
      // Full filename is attachment_png_{rest}; render inline as image
      items.push({ kind: 'addedFile', name: `attachment_png_${rest}`, imgType: 'image' });
      return '';
    })
    .replace(/addedFile:(\S+)/g, (_, name) => {
      items.push({ kind: 'addedFile', name, imgType: isImg(name) ? 'image' : 'file' });
      return '';
    })
    .trim();
  return { text, items };
}

function buildDesc(text: string, items: AttachItem[]): string {
  const tokens = items.map(a => {
    if (a.kind === 'pcImage') return a.token;
    if (a.name.startsWith('attachment_png_')) return `[[${a.name}]]`;
    return `addedFile:${a.name}`;
  });
  return [text.trim(), ...tokens].filter(Boolean).join('\n');
}

// ─── TrashIcon ───────────────────────────────────────────────────────────────

function TrashIcon({ color }: { color: string }) {
  return (
    <View style={{ alignItems: 'center', width: 16 }}>
      <View style={{ width: 16, height: 2.5, backgroundColor: color, borderRadius: 1, marginBottom: 1.5 }} />
      <View style={{ position: 'absolute', top: -3, width: 6, height: 3,
                     borderTopLeftRadius: 2, borderTopRightRadius: 2,
                     borderWidth: 2, borderColor: color, borderBottomWidth: 0 }} />
      <View style={{ width: 12, height: 14, borderWidth: 1.5, borderColor: color,
                     borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
                     borderTopWidth: 0, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: 2.5, top: 2, bottom: 2, width: 1, backgroundColor: color, opacity: 0.5 }} />
        <View style={{ position: 'absolute', left: 5.5, top: 2, bottom: 2, width: 1, backgroundColor: color, opacity: 0.5 }} />
      </View>
    </View>
  );
}

// ─── AttachImageView ─────────────────────────────────────────────────────────

function AttachImageView({ name, localUri, config }: { name: string; localUri?: string; config: AppConfig | null }) {
  const C = useColors();
  const [imgError, setImgError] = useState(false);

  const source = React.useMemo(() => {
    if (localUri) return { uri: localUri };
    if (!config) return null;
    const { pat, owner, repo } = config.github;
    const folder = name.startsWith('attachment_png_') ? 'attachments' : 'files';
    return {
      uri: `https://raw.githubusercontent.com/${owner}/${repo}/main/${folder}/${encodeURIComponent(name)}`,
      headers: { Authorization: `Bearer ${pat}` },
    };
  }, [localUri, config, name]);

  if (!source) {
    return (
      <View style={{ height: 80, alignItems: 'center', justifyContent: 'center',
                     backgroundColor: C.surfaceAlt, borderRadius: R.sm }}>
        <ActivityIndicator color={C.brand} />
      </View>
    );
  }
  if (imgError) {
    return (
      <View style={{ height: 80, alignItems: 'center', justifyContent: 'center',
                     backgroundColor: C.surfaceAlt, borderRadius: R.sm }}>
        <Text style={{ color: C.textMuted, fontSize: 12 }}>Image unavailable</Text>
        <Text style={{ color: C.textHint, fontSize: 11, marginTop: 2 }}>{name}</Text>
      </View>
    );
  }
  return (
    <Image
      source={source}
      style={{ width: '100%', height: 200, borderRadius: R.sm, backgroundColor: C.surfaceAlt }}
      resizeMode="contain"
      onError={() => setImgError(true)}
    />
  );
}

// ─── AttachmentCard ──────────────────────────────────────────────────────────

function AttachmentCard({ item, config, onRemove }: { item: AttachItem; config: AppConfig | null; onRemove: () => void }) {
  const C      = useColors();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  if (item.kind === 'pcImage') {
    return (
      <View style={styles.attachCard}>
        <View style={[styles.attachBadge, { backgroundColor: C.surfaceAlt }]}>
          <Text style={styles.attachBadgeText}>IMG</Text>
        </View>
        <Text style={[styles.attachName, { color: C.textMuted, fontStyle: 'italic' }]} numberOfLines={1}>
          Desktop image (PC only)
        </Text>
      </View>
    );
  }
  if (item.imgType === 'image') {
    return (
      <View style={styles.attachImageWrap}>
        <AttachImageView name={item.name} localUri={item.localUri} config={config} />
        <Text style={styles.attachImageName} numberOfLines={1}>{item.name}</Text>
        <TouchableOpacity onPress={onRemove} style={styles.attachImageTrash}>
          <TrashIcon color={C.white} />
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={styles.attachCard}>
      <View style={styles.attachBadge}>
        <Text style={styles.attachBadgeText}>{fileBadge(item.name)}</Text>
      </View>
      <Text style={styles.attachName} numberOfLines={1}>{item.name}</Text>
      <TouchableOpacity onPress={onRemove} style={styles.attachTrash}>
        <TrashIcon color={C.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function NoteEditScreen() {
  const nav   = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { notes, updateNote } = useNotes();

  const C      = useColors();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const existingId = route.params?.id;
  const isNew      = !existingId;
  const existing   = existingId ? (notes[existingId] as NoteRecord) : null;

  // Build initial description: include the # title line.
  // Old Android notes stored description without the title (separate header field) — migrate those.
  const { initText, initItems } = useMemo(() => {
    const raw = existing?.description ?? '';
    const { text, items } = parseDesc(raw);
    let fullText = text;
    if (!text.trimStart().startsWith('#') && existing?.header) {
      fullText = existing.header + (text ? '\n' + text : '');
    }
    return { initText: fullText, initItems: items };
  }, []);

  const [tag,         setTag]         = useState(existing?.tag ?? '');
  const [description, setDescription] = useState(isNew ? '# ' : initText);
  const [attachItems, setAttachItems] = useState<AttachItem[]>(initItems);
  const [saving,      setSaving]      = useState(false);
  const [config,      setConfig]      = useState<AppConfig | null>(null);

  // Stable note ID: pre-generated for new notes so image filenames can reference it before save
  const noteId = useMemo(() => existingId ?? generateId(notes), []);

  // Prevents accidental Save trigger from Android touch events right after a picker closes
  const justPickedRef  = useRef(false);
  const imageCountRef  = useRef(0);
  const textInputRef   = useRef<TextInput>(null);
  const scrollViewRef  = useRef<ScrollView>(null);
  const descriptionY   = useRef(0);

  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newTagInput,   setNewTagInput]   = useState('');

  useEffect(() => {
    loadConfig().then(setConfig).catch(() => {});
  }, []);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    getNoteRecords(notes).forEach(({ record }) => { if (record.tag) set.add(record.tag); });
    return Array.from(set).sort();
  }, [notes]);

  const pickFile = useCallback(async () => {
    textInputRef.current?.blur();
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      justPickedRef.current = true;
      setTimeout(() => { justPickedRef.current = false; }, 600);
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      if (a.size && a.size > SIZE_LIMIT) {
        Alert.alert('File too large', 'File attached is larger than 48 Mb and will not be synced.');
        return;
      }

      const safeName = a.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      let base64: string;
      let localUri = a.uri;

      try {
        // Primary: copy to file:// cache path, then read — works for local/on-device files
        const safeUri = (FileSystem.cacheDirectory ?? '') + safeName;
        await FileSystem.copyAsync({ from: a.uri, to: safeUri });
        localUri = safeUri;
        base64 = await FileSystem.readAsStringAsync(safeUri, { encoding: 'base64' });
      } catch {
        // Fallback: fetch as ArrayBuffer then encode — RN fetch handles content:// URIs on Android
        const resp = await fetch(a.uri);
        const ab   = await resp.arrayBuffer();
        const bytes = new Uint8Array(ab);
        const chars: string[] = [];
        for (let i = 0; i < bytes.length; i++) chars.push(String.fromCharCode(bytes[i]));
        base64 = btoa(chars.join(''));
      }

      setAttachItems(prev => [...prev, {
        kind: 'addedFile', name: a.name,
        imgType: isImg(a.name) ? 'image' : 'file',
        localUri, base64, isNew: true,
      }]);
    } catch (e: any) {
      Alert.alert('Could not read file', e.message ?? 'Unknown error');
    }
  }, []);

  const pickImage = useCallback(async () => {
    textInputRef.current?.blur();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow access to your photo library in settings.');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as any,
        quality: 0.9,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > SIZE_LIMIT) {
        Alert.alert('File too large', 'File attached is larger than 48 Mb and will not be synced.');
        return;
      }
      const idx  = imageCountRef.current++;
      const name = `attachment_png_${noteId}_${Date.now()}_${idx}.png`;
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
      setAttachItems(prev => [...prev, {
        kind: 'addedFile', name, imgType: 'image',
        localUri: asset.uri, base64, isNew: true,
      }]);
    } catch (e: any) {
      Alert.alert('Could not read image', e.message ?? 'Unknown error');
    } finally {
      justPickedRef.current = true;
      setTimeout(() => { justPickedRef.current = false; }, 600);
    }
  }, [noteId]);

  function removeAttachment(idx: number) {
    setAttachItems(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (justPickedRef.current) return;
    const firstLine = description.trim().split('\n')[0].trim();
    if (!firstLine) {
      Alert.alert('Title required', 'The first line of the note is used as its title.');
      return;
    }
    if (!tag.trim()) {
      Alert.alert('Tag required', 'Please select or create a tag.');
      setShowTagPicker(true);
      return;
    }
    setSaving(true);
    try {
      if (config) {
        const newItems = attachItems.filter(
          (a): a is Extract<AttachItem, { kind: 'addedFile' }> & { isNew: true; base64: string } =>
            a.kind === 'addedFile' && !!a.isNew && !!a.base64
        );
        for (const item of newItems) {
          if (item.name.startsWith('attachment_png_')) {
            const existingSha = await getAttachmentSha(config, item.name);
            await uploadAttachment(config, item.name, item.base64, existingSha);
          } else {
            const existingSha = await getFileSha(config, item.name);
            await uploadFile(config, item.name, item.base64, existingSha);
          }
        }
      }

      const headerLine = firstLine.startsWith('#') ? firstLine : `# ${firstLine}`;
      const fullDesc   = buildDesc(description, attachItems);
      const now = localISOString();
      const id  = noteId;
      const record: NoteRecord = {
        ...(existing ?? {} as any),
        header:      headerLine,
        tag:         tag.trim(),
        project:     existing?.project ?? '',
        description: fullDesc,
        color:       existing?.color ?? 'none',
        status:      existing?.status ?? '',
        ishidden:    existing?.ishidden ?? '',
        created:     existing?.created ?? now,
        lastchanged: now,
      };
      await updateNote(id, record);
      nav.goBack();
    } catch (e: any) {
      Alert.alert('Save failed', e.message);
    } finally {
      setSaving(false);
    }
  }

  useLayoutEffect(() => {
    nav.setOptions({
      title: isNew ? 'New Note' : 'Edit Note',
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={pickFile} activeOpacity={0.7}>
            <Text style={styles.headerBtnText}>+ File</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={pickImage} activeOpacity={0.7}>
            <Text style={styles.headerBtnText}>+ Image</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleSave} disabled={saving} activeOpacity={0.7}>
            {saving
              ? <ActivityIndicator color={C.brand} size="small" />
              : <Text style={styles.headerBtnText}>Save</Text>
            }
          </TouchableOpacity>
        </View>
      ),
    });
  }, [saving, description, attachItems, tag, config, isNew, styles, pickFile, pickImage]);

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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView ref={scrollViewRef} style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.label}>
          Work <Text style={styles.required}>*</Text>
        </Text>
        <TouchableOpacity
          style={[styles.picker, !tag && styles.pickerWarn]}
          onPress={() => setShowTagPicker(true)}
        >
          <Text style={tag ? styles.pickerValue : styles.pickerPlaceholder}>
            {tag || 'Select or create tag…'}
          </Text>
          {tag ? (
            <TouchableOpacity
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => setTag('')}
            >
              <Text style={styles.pickerClear}>✕</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.pickerArrow}>›</Text>
          )}
        </TouchableOpacity>

        <Text
          style={styles.label}
          onLayout={e => { descriptionY.current = e.nativeEvent.layout.y; }}
        >Note</Text>
        <TextInput
          ref={textInputRef}
          style={styles.textArea}
          placeholder={'# Note title\n\nWrite your note here…'}
          placeholderTextColor={C.textHint}
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
          autoFocus={isNew}
          onFocus={() => scrollViewRef.current?.scrollTo({ y: descriptionY.current, animated: true })}
        />

        {attachItems.length > 0 && (
          <>
            <Text style={styles.attachLabel}>Attachments</Text>
            {attachItems.map((item, idx) => (
              <AttachmentCard
                key={idx}
                item={item}
                config={config}
                onRemove={() => removeAttachment(idx)}
              />
            ))}
          </>
        )}

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
        styles={styles}
        C={C}
      />
    </KeyboardAvoidingView>
  );
}

// ─── PickerModal ─────────────────────────────────────────────────────────────

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
  styles: ReturnType<typeof makeStyles>;
  C: ColorsType;
};

function PickerModal({
  visible, title, items, selected, newValue, onNewValueChange,
  onSelect, onAddNew, onClose, styles, C,
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

// ─── helpers ─────────────────────────────────────────────────────────────────

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

// ─── styles ──────────────────────────────────────────────────────────────────

function makeStyles(C: ColorsType) {
  return StyleSheet.create({
    container:        { flex: 1, backgroundColor: C.bg },
    content:          { padding: SP.md, paddingBottom: 48 },

    label:            { fontSize: 11, color: C.textMuted, fontWeight: '700', marginTop: 18, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
    required:         { color: C.error },

    picker:           { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 11, backgroundColor: C.surface },
    pickerWarn:       { borderColor: '#F5A7A7', backgroundColor: '#FFFAFA' },
    pickerValue:      { flex: 1, fontSize: 15, color: C.text },
    pickerPlaceholder:{ flex: 1, fontSize: 15, color: C.textHint },
    pickerArrow:      { fontSize: 18, color: C.textHint },
    pickerClear:      { fontSize: 16, color: C.textMuted, paddingHorizontal: 4 },

    textArea:         { borderWidth: 1, borderColor: C.border, borderRadius: R.sm, padding: 10, fontSize: 15, color: C.text, minHeight: 240, backgroundColor: C.surface },

    attachLabel:      { fontSize: 11, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },

    attachCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
                        borderRadius: R.md, marginBottom: SP.xs,
                        paddingHorizontal: SP.md, paddingVertical: SP.sm + 2, ...S.sm },
    attachBadge:      { width: 36, height: 36, borderRadius: R.xs, borderWidth: 1,
                        borderColor: C.border, alignItems: 'center', justifyContent: 'center',
                        marginRight: 12, backgroundColor: C.surfaceAlt },
    attachBadgeText:  { fontSize: 9, fontWeight: '700', color: C.textSub, letterSpacing: 0.5 },
    attachName:       { flex: 1, fontSize: 14, color: C.text, fontWeight: '500' },
    attachTrash:      { marginLeft: 12, padding: 6 },

    attachImageWrap:  { marginBottom: SP.sm, borderRadius: R.md, overflow: 'hidden', backgroundColor: C.surface, ...S.sm },
    attachImageName:  { fontSize: 11, color: C.textMuted, padding: 6, paddingHorizontal: 10 },
    attachImageTrash: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: 6 },

    deleteBtn:        { marginTop: 32, padding: 14, borderRadius: R.sm, backgroundColor: '#FFF3F3', alignItems: 'center', borderWidth: 1, borderColor: '#F5A7A7' },
    deleteBtnText:    { color: C.error, fontWeight: '600', fontSize: 15 },

    headerActions:    { flexDirection: 'row', gap: 6, marginRight: 0 },
    headerBtn:        { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.surface, borderRadius: R.sm, borderWidth: 1.5, borderColor: C.brand },
    headerBtnText:    { color: C.text, fontWeight: '600', fontSize: 13 },

    overlay:          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
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
}
