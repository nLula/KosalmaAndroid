import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNotes, getTagsForProject } from '../../services/notesContext';
import { NotesStackParams } from '../NotesScreen';
import { useColors } from '../../services/themeContext';
import { ColorsType } from '../../theme';

type Nav   = NativeStackNavigationProp<NotesStackParams, 'Tags'>;
type Route = RouteProp<NotesStackParams, 'Tags'>;

export default function TagListScreen() {
  const nav   = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { project } = route.params;
  const { notes } = useNotes();
  const tags = getTagsForProject(notes, project);

  const C = useColors();
  const styles = React.useMemo(() => makeStyles(C), [C]);

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

function makeStyles(C: ColorsType) {
  return StyleSheet.create({
    container:  { flex: 1, backgroundColor: C.bg },
    breadcrumb: { padding: 10, fontSize: 12, color: C.textMuted, backgroundColor: C.surfaceAlt, borderBottomWidth: 0.5, borderBottomColor: C.borderLight },
    row:        { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: C.borderLight },
    name:       { flex: 1, fontSize: 15, color: C.text },
    arrow:      { fontSize: 20, color: C.textHint },
    empty:      { textAlign: 'center', marginTop: 60, color: C.textMuted, fontSize: 14 },
  });
}
