import React from 'react';
import { View, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CalendarMainScreen from './calendar/CalendarMainScreen';
import DayViewScreen      from './calendar/DayViewScreen';
import { C, S } from '../theme';

export type CalendarStackParams = {
  CalendarMain: undefined;
  DayView: { dateStr: string }; // YYYYMMDD
};

const Stack = createNativeStackNavigator<CalendarStackParams>();

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

export default function CalendarScreen() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle,
        headerTintColor:  C.brand,
        headerTitleStyle: { fontWeight: '700', fontSize: 17, color: C.text },
      }}
    >
      <Stack.Screen
        name="CalendarMain"
        component={CalendarMainScreen}
        options={{ headerTitle: () => <TipTitle title="Calendar" /> }}
      />
      <Stack.Screen name="DayView" component={DayViewScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}
