import React, { useState, useCallback, useEffect, useLayoutEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, RefreshControl, Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker    from 'expo-image-picker';
import * as FileSystem     from 'expo-file-system/legacy';
import { loadConfig }      from '../services/storage';
import { fetchFilesList, uploadFile, deleteGithubFile } from '../services/githubApi';
import { useNotes, localISOString } from '../services/notesContext';
import { useColors } from '../services/themeContext';
import { S, R, SP, ColorsType } from '../theme';

// ─── types ───────────────────────────────────────────────────────────────────

type GHFile = {
  name: string;
  path: string;
  sha: string;
  size: number;
  download_url: string;
  type: 'file' | 'dir';
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileLabel(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg','jpeg','png','gif','bmp','webp','heic'].includes(ext)) return 'IMG';
  if (['pdf'].includes(ext))                                         return 'PDF';
  if (['dwg','dxf','dwl','dwl2','bak'].includes(ext))               return 'DWG';
  if (['zip','rar','7z'].includes(ext))                             return 'ZIP';
  if (['txt','csv','html','md'].includes(ext))                      return 'TXT';
  return ext.toUpperCase().slice(0, 3) || 'FILE';
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function cutoffKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Trash icon drawn with Views ─────────────────────────────────────────────

function TrashIcon({ color }: { color: string }) {
  return (
    <View style={{ alignItems: 'center', width: 16 }}>
      {/* lid */}
      <View style={{ width: 16, height: 2.5, backgroundColor: color, borderRadius: 1, marginBottom: 1.5 }} />
      {/* handle on lid */}
      <View style={{ position: 'absolute', top: -3, width: 6, height: 3,
                     borderTopLeftRadius: 2, borderTopRightRadius: 2,
                     borderWidth: 2, borderColor: color, borderBottomWidth: 0 }} />
      {/* body */}
      <View style={{ width: 12, height: 14, borderWidth: 1.5, borderColor: color,
                     borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
                     borderTopWidth: 0, overflow: 'hidden' }}>
        {/* inner lines */}
        <View style={{ position: 'absolute', left: 2.5, top: 2, bottom: 2, width: 1, backgroundColor: color, opacity: 0.5 }} />
        <View style={{ position: 'absolute', left: 5.5, top: 2, bottom: 2, width: 1, backgroundColor: color, opacity: 0.5 }} />
      </View>
    </View>
  );
}

// ─── component ───────────────────────────────────────────────────────────────

export default function FilesScreen() {
  const navigation              = useNavigation();
  const { notes, updateNote }   = useNotes();
  const [files,      setFiles]      = useState<GHFile[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  const C = useColors();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const loadFiles = useCallback(async () => {
    try {
      setError(null);
      const config = await loadConfig();
      const list   = await fetchFilesList(config);
      setFiles(
        list.filter(f => f.type === 'file')
            .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { loadFiles().finally(() => setLoading(false)); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await loadFiles();
    setRefreshing(false);
  }

  async function trackDeletedFile(filePath: string) {
    const dfKey   = 'deletedFiles';
    const df      = (notes[dfKey] as Record<string, string>) ?? {};
    const today   = todayKey();
    const cutoff  = cutoffKey();
    const norm    = filePath.startsWith('files/') ? filePath : `files/${filePath}`;
    const entry   = `${norm};`;

    const updated: Record<string, string> = {};
    for (const [k, v] of Object.entries(df)) {
      if (k === 'lastchanged') continue;
      if (k >= cutoff) updated[k] = v;
    }
    updated[today]         = (updated[today] ?? '') + entry;
    updated['lastchanged'] = localISOString();

    await updateNote(dfKey, updated as any);
  }

  async function handleDelete(file: GHFile) {
    Alert.alert(
      'Delete file',
      `Delete "${file.name}" from the repository?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setDeletingId(file.sha);
            try {
              const config = await loadConfig();
              await deleteGithubFile(config, file.path, file.sha);
              await trackDeletedFile(file.path);
              setFiles(prev => prev.filter(f => f.sha !== file.sha));
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  }

  const pickAndUpload = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      await doUpload(a.uri, a.name);
    } catch {
      // user dismissed
    }
  }, []);

  const pickImageAndUpload = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow access to your photo library in settings.');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.9,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset    = result.assets[0];
      const filename = asset.fileName ?? asset.uri.split('/').pop() ?? `photo_${Date.now()}.jpg`;
      await doUpload(asset.uri, filename);
    } catch {
      // user dismissed
    }
  }, []);

  async function doUpload(uri: string, filename: string) {
    setUploading(true);
    try {
      const config  = await loadConfig();
      const base64  = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const existing = files.find(f => f.name === filename);
      await uploadFile(config, filename, base64, existing?.sha);
      await loadFiles();
      Alert.alert('Uploaded', `"${filename}" uploaded successfully.`);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setUploading(false);
    }
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          {uploading ? (
            <ActivityIndicator size="small" color={C.text} style={{ marginRight: 12 }} />
          ) : (
            <>
              <TouchableOpacity style={styles.headerBtn} onPress={pickAndUpload} activeOpacity={0.7}>
                <Text style={styles.headerBtnLabel}>File</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerBtn} onPress={pickImageAndUpload} activeOpacity={0.7}>
                <Text style={styles.headerBtnLabel}>Gallery</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ),
    });
  }, [navigation, uploading, pickAndUpload, pickImageAndUpload, styles]);

  function openFile(file: GHFile) {
    Linking.openURL(file.download_url).catch(() =>
      Alert.alert('Cannot open', 'No app available for this file type.')
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.brand} />
        <Text style={styles.loadingText}>Loading files…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={files}
        keyExtractor={f => f.path}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} colors={[C.brand]} />
        }
        contentContainerStyle={styles.list}
        ListHeaderComponent={error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>⚠ {error}</Text>
          </View>
        ) : null}
        ListEmptyComponent={!error ? (
          <Text style={styles.emptyText}>No files in repository.{'\n'}Pull down to refresh.</Text>
        ) : null}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity style={styles.fileInfo} onPress={() => openFile(item)} activeOpacity={0.7}>
              <View style={styles.fileIconWrap}>
                <Text style={styles.fileTypeLabel}>{fileLabel(item.name)}</Text>
              </View>
              <View style={styles.fileMeta}>
                <Text style={styles.fileName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.fileSize}>{fmtSize(item.size)}</Text>
              </View>
            </TouchableOpacity>
            {deletingId === item.sha
              ? <ActivityIndicator size="small" color={C.error} style={{ marginLeft: 12 }} />
              : (
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.deleteBtn}
                >
                  <TrashIcon color={C.textMuted} />
                </TouchableOpacity>
              )
            }
          </View>
        )}
      />
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

function makeStyles(C: ColorsType) {
  return StyleSheet.create({
    container:     { flex: 1, backgroundColor: C.bg },
    center:        { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
    loadingText:   { marginTop: 12, color: C.textMuted, fontSize: 14 },
    list:          { padding: SP.sm, paddingBottom: SP.xl },

    errorCard:     { backgroundColor: '#FFF5F5', borderRadius: R.sm, padding: SP.md, marginBottom: SP.sm },
    errorText:     { color: C.error, fontSize: 13, fontWeight: '500' },
    emptyText:     { textAlign: 'center', marginTop: 60, color: C.textMuted, fontSize: 14, lineHeight: 22 },

    card:          { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
                     borderRadius: R.md, marginBottom: SP.sm,
                     paddingHorizontal: SP.md, paddingVertical: SP.sm + 2, ...S.sm },
    fileInfo:      { flex: 1, flexDirection: 'row', alignItems: 'center' },
    fileIconWrap:  { width: 36, height: 36, borderRadius: R.xs, borderWidth: 1,
                     borderColor: C.border, alignItems: 'center', justifyContent: 'center',
                     marginRight: 12, backgroundColor: C.surfaceAlt },
    fileTypeLabel: { fontSize: 9, fontWeight: '700', color: C.textSub, letterSpacing: 0.5 },
    fileMeta:      { flex: 1 },
    fileName:      { fontSize: 14, color: C.text, fontWeight: '500' },
    fileSize:      { fontSize: 11, color: C.textMuted, marginTop: 2 },
    deleteBtn:     { marginLeft: 12, padding: 6 },

    headerActions: { flexDirection: 'row', gap: 6, marginRight: 8 },
    headerBtn:     { borderWidth: 1.5, borderColor: C.brand, borderRadius: R.sm,
                     paddingHorizontal: 10, paddingVertical: 4,
                     backgroundColor: C.surface },
    headerBtnLabel:{ fontSize: 13, fontWeight: '600', color: C.text },
  });
}
