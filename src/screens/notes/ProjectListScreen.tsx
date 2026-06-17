import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNotes, getProjects } from '../../services/notesContext';
import { NotesStackParams } from '../NotesScreen';
import SyncBar from '../../components/SyncBar';
import { useColors } from '../../services/themeContext';
import { ColorsType } from '../../theme';

type Nav = NativeStackNavigationProp<NotesStackParams, 'Projects'>;

export default function ProjectListScreen() {
  const nav = useNavigation<Nav>();
  const { notes, loading, error, refresh, lastSync } = useNotes();
  const projects = getProjects(notes);

  const C = useColors();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  return (
    <View style={styles.container}>
      <SyncBar lastSync={lastSync} loading={loading} error={error} />
      <FlatList
        data={projects}
        keyExtractor={item => item}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} colors={[C.brand]} tintColor={C.brand} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => nav.navigate('Tags', { project: item })}>
            <Text style={styles.name}>{item || '(no project)'}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator style={{ marginTop: 40 }} color={C.brand} />
            : <Text style={styles.empty}>{error ?? 'No projects found'}</Text>
        }
      />
    </View>
  );
}

function makeStyles(C: ColorsType) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    row:       { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: C.borderLight },
    name:      { flex: 1, fontSize: 15, color: C.text },
    arrow:     { fontSize: 20, color: C.textHint },
    empty:     { textAlign: 'center', marginTop: 60, color: C.textMuted, fontSize: 14 },
  });
}
