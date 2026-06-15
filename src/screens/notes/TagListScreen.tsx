import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNotes, getTagsForProject } from '../../services/notesContext';
import { NotesStackParams } from '../NotesScreen';

type Nav   = NativeStackNavigationProp<NotesStackParams, 'Tags'>;
type Route = RouteProp<NotesStackParams, 'Tags'>;

export default function TagListScreen() {
  const nav   = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { project } = route.params;
  const { notes } = useNotes();
  const tags = getTagsForProject(notes, project);

  return (
    <View style={styles.container}>
      <Text style={styles.breadcrumb}>{project}</Text>
      <FlatList
        data={tags}
        keyExtractor={item => item}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => nav.navigate('Headers', { project, tag: item })}>
            <Text style={styles.name}>{item || '(no tag)'}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No tags</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#fff' },
  breadcrumb: { padding: 10, fontSize: 12, color: '#888', backgroundColor: '#f7f7f7', borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  row:        { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  name:       { flex: 1, fontSize: 15, color: '#222' },
  arrow:      { fontSize: 20, color: '#bbb' },
  empty:      { textAlign: 'center', marginTop: 60, color: '#aaa', fontSize: 14 },
});
