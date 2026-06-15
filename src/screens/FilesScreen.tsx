import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, RefreshControl, Linking,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker    from 'expo-image-picker';
import * as FileSystem     from 'expo-file-system/legacy';
import { loadConfig }      from '../services/storage';
import { fetchFilesList, uploadFile, deleteGithubFile } from '../services/githubApi';
import { useNotes, localISOString } from '../services/notesContext';
import { C, S, R, SP } from '../theme';

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

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg','jpeg','png','gif','bmp','webp','heic'].includes(ext)) return '🖼';
  if (['pdf'].includes(ext))                                         return '📄';
  if (['dwg','dxf','dwl','dwl2','bak'].includes(ext))               return '📐';
  if (['zip','rar','7z'].includes(ext))                             return '🗜';
  if (['txt','csv','html','md'].includes(ext))                      return '📃';
  return '📎';
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

// PC app prunes entries older than 2 days
function cutoffKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

// ─── component ───────────────────────────────────────────────────────────────

export default function FilesScreen() {
  const { notes, updateNote } = useNotes();
  const [files,      setFiles]      = useState<GHFile[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);

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

  async function pickAndUpload() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      await doUpload(result.assets[0].uri, result.assets[0].name);
    } catch {
      // User dismissed the picker (hardware back button on Android)
    }
  }

  async function pickImageAndUpload() {
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
      // User dismissed the picker
    }
  }

  async function doUpload(uri: string, filename: string) {
    setUploading(true);
    try {
      const config  = await loadConfig();
      const base64  = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',   // use string literal — FileSystem.EncodingType can be undefined at runtime
      });
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
          <Text style={styles.emptyText}>No files in repository.{'\n'}Upload one below.</Text>
        ) : null}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity style={styles.fileInfo} onPress={() => openFile(item)} activeOpacity={0.7}>
              <Text style={styles.fileIcon}>{fileIcon(item.name)}</Text>
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
                  <Text style={styles.deleteIcon}>🗑</Text>
                </TouchableOpacity>
              )
            }
          </View>
        )}
      />

      <View style={styles.footer}>
        {uploading
          ? <ActivityIndicator size="large" color={C.brand} style={{ marginVertical: 8 }} />
          : (
            <View style={styles.uploadRow}>
              <TouchableOpacity style={styles.uploadBtn} onPress={pickAndUpload}>
                <Text style={styles.uploadBtnText}>📎  File</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadBtn} onPress={pickImageAndUpload}>
                <Text style={styles.uploadBtnText}>🖼  Gallery</Text>
              </TouchableOpacity>
            </View>
          )
        }
      </View>
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: C.bg },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  loadingText:   { marginTop: 12, color: C.textMuted, fontSize: 14 },
  list:          { padding: SP.sm, paddingBottom: SP.xl },

  errorCard:     { backgroundColor: '#FFF5F5', borderRadius: R.sm, padding: SP.md, marginBottom: SP.sm },
  errorText:     { color: C.error, fontSize: 13, fontWeight: '500' },
  emptyText:     { textAlign: 'center', marginTop: 60, color: C.textMuted, fontSize: 14, lineHeight: 22 },

  card:          { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.md, marginBottom: SP.sm, paddingHorizontal: SP.md, paddingVertical: SP.sm + 2, ...S.sm },
  fileInfo:      { flex: 1, flexDirection: 'row', alignItems: 'center' },
  fileIcon:      { fontSize: 22, marginRight: 12, width: 30, textAlign: 'center' },
  fileMeta:      { flex: 1 },
  fileName:      { fontSize: 14, color: C.text, fontWeight: '500' },
  fileSize:      { fontSize: 11, color: C.textMuted, marginTop: 2 },
  deleteBtn:     { marginLeft: 12, padding: 4 },
  deleteIcon:    { fontSize: 18 },

  footer:        { borderTopWidth: 0.5, borderTopColor: C.borderLight, padding: SP.sm, backgroundColor: C.surface },
  uploadRow:     { flexDirection: 'row', gap: 10 },
  uploadBtn:     { flex: 1, backgroundColor: C.brand, borderRadius: R.md, padding: 13, alignItems: 'center' },
  uploadBtnText: { color: C.white, fontWeight: '700', fontSize: 15 },
});
