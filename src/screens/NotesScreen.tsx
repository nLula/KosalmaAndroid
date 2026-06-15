import React from 'react';
import { View, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import NotesListScreen from './notes/NotesListScreen';
import NoteEditScreen  from './notes/NoteEditScreen';
import { C, S } from '../theme';

export type NotesStackParams = {
  NotesList: undefined;
  NoteEdit:  { id?: string };
};

const Stack = createNativeStackNavigator<NotesStackParams>();

const headerStyle = {
  backgroundColor: C.surface,
  ...S.xs,
  shadowOffset: { width: 0, height: 1 },
  elevation: 2,
} as const;

function TipTitle({ title }: { title: string }) {
  return (
    <View>
      <Text style={{ fontWeight: '700', fontSize: 17, color: C.text }}>{title}</Text>
      <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>⬇ Pull to refresh</Text>
    </View>
  );
}

export default function NotesScreen() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle,
        headerTintColor:  C.brand,
        headerTitleStyle: { fontWeight: '700', fontSize: 17, color: C.text },
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
