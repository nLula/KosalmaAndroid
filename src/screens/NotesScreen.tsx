import React from 'react';
import { View, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import NotesListScreen from './notes/NotesListScreen';
import NoteEditScreen  from './notes/NoteEditScreen';
import { useColors } from '../services/themeContext';
import { S } from '../theme';

export type NotesStackParams = {
  NotesList: undefined;
  NoteEdit:  { id?: string };
};

const Stack = createNativeStackNavigator<NotesStackParams>();

function TipTitle({ title }: { title: string }) {
  const C = useColors();
  return (
    <View>
      <Text style={{ fontWeight: '700', fontSize: 17, color: C.text }}>{title}</Text>
      <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>⬇ Pull to refresh</Text>
    </View>
  );
}

export default function NotesScreen() {
  const C = useColors();
  const headerStyle = React.useMemo(() => ({
    backgroundColor: C.surface,
    ...S.xs,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  }), [C]);

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle,
        headerTintColor:  C.brand,
        headerTitleStyle: { fontWeight: '700', fontSize: 17, color: C.text },
        headerRightContainerStyle: { paddingRight: 0 },
      }}
    >
      <Stack.Screen
        name="NotesList"
        component={NotesListScreen}
        options={{ headerTitle: () => <TipTitle title="Notes" /> }}
      />
      <Stack.Screen name="NoteEdit" component={NoteEditScreen} options={{ title: 'Note' }} />
    </Stack.Navigator>
  );
}
