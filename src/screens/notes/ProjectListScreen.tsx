import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNotes, getProjects } from '../../services/notesContext';
import { NotesStackParams } from '../NotesScreen';
import SyncBar from '../../components/SyncBar';

type Nav = NativeStackNavigationProp<NotesStackParams, 'Projects'>;

export default function ProjectListScreen() {
  const nav = useNavigation<Nav>();
  const { notes, loading, error, refresh, lastSync } = useNotes();
  const projects = getProjects(notes);

  return (
    <View style={styles.container}>
      <SyncBar lastSync={lastSync} loading={loading} error={error} />
      <FlatList
        data={projects}
        keyExtractor={item => item}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} colors={['#00a99d']} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => nav.navigate('Tags', { project: item })}>
            <Text style={styles.name}>{item || '(no project)'}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator style={{ marginTop: 40 }} color="#00a99d" />
            : <Text style={styles.empty}>{error ?? 'No projects found'}</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  row:       { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  name:      { flex: 1, fontSize: 15, color: '#222' },
  arrow:     { fontSize: 20, color: '#bbb' },
  empty:     { textAlign: 'center', marginTop: 60, color: '#aaa', fontSize: 14 },
});
