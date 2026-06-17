import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNotes, getHeadersForTag } from '../../services/notesContext';
import { NotesStackParams } from '../NotesScreen';
import { useColors } from '../../services/themeContext';
import { ColorsType } from '../../theme';

type Nav   = NativeStackNavigationProp<NotesStackParams, 'Headers'>;
type Route = RouteProp<NotesStackParams, 'Headers'>;

export default function HeaderListScreen() {
  const nav   = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { project, tag } = route.params;
  const { notes } = useNotes();
  const headers = getHeadersForTag(notes, project, tag);

  const C = useColors();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  return (
    <View style={styles.container}>
      <Text style={styles.breadcrumb}>{project}  ›  {tag}</Text>
      <FlatList
        data={headers}
        keyExtractor={({ id }) => id}
        renderItem={({ item: { id, record } }) => (
          <TouchableOpacity style={styles.row} onPress={() => nav.navigate('NoteDetail', { id })}>
            {record.color && record.color !== 'none' && (
              <View style={[styles.dot, { backgroundColor: `#${record.color}` }]} />
            )}
            <View style={styles.textWrap}>
              <Text style={styles.header}>{record.header.replace(/^#+\s*/, '')}</Text>
              {record.createdForDate ? (
                <Text style={styles.dateTag}>📅 {parseDate(record.createdForDate)}</Text>
              ) : null}
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No notes in this tag</Text>}
      />
    </View>
  );
}

function parseDate(raw: string): string {
  const match = raw.match(/:(\d{8});/);
  if (!match) return '';
  const d = match[1];
  return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
}

function makeStyles(C: ColorsType) {
  return StyleSheet.create({
    container:  { flex: 1, backgroundColor: C.bg },
    breadcrumb: { padding: 10, fontSize: 12, color: C.textMuted, backgroundColor: C.surfaceAlt, borderBottomWidth: 0.5, borderBottomColor: C.borderLight },
    row:        { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 0.5, borderBottomColor: C.borderLight },
    dot:        { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
    textWrap:   { flex: 1 },
    header:     { fontSize: 15, color: C.text },
    dateTag:    { fontSize: 11, color: C.brand, marginTop: 2 },
    arrow:      { fontSize: 20, color: C.textHint },
    empty:      { textAlign: 'center', marginTop: 60, color: C.textMuted, fontSize: 14 },
  });
}
