import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';

import { NotesProvider } from './src/services/notesContext';
import NotesScreen      from './src/screens/NotesScreen';
import CalendarScreen   from './src/screens/CalendarScreen';
import MonitorScreen    from './src/screens/MonitorScreen';
import HoursScreen      from './src/screens/HoursScreen';
import FilesScreen      from './src/screens/FilesScreen';
import StatisticsScreen from './src/screens/StatisticsScreen';
import SettingsScreen   from './src/screens/SettingsScreen';
import { C, S, R } from './src/theme';

const Tab = createBottomTabNavigator();

const ICONS: Record<string, string> = {
  Notes: '📝', Calendar: '📅', Monitor: '🖥️', Hours: '⏱',
  Files: '📁', Statistics: '📊', Settings: '⚙️',
};

const SHORT: Record<string, string> = {
  Notes: 'Notes', Calendar: 'Rota', Monitor: 'View',
  Hours: 'Hours', Files: 'Files', Statistics: 'Stats', Settings: 'Setup',
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <View style={[tab.item, focused && tab.itemActive]}>
      <Text style={[tab.icon, focused && tab.iconActive]}>{ICONS[name] ?? '•'}</Text>
      <Text style={[tab.label, focused && tab.labelActive]} numberOfLines={1}>{SHORT[name]}</Text>
    </View>
  );
}

const tab = StyleSheet.create({
  item:        { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 5, borderRadius: R.md, gap: 2, minWidth: 44, borderWidth: 1.5, borderColor: 'transparent' },
  itemActive:  { borderColor: C.brand },
  icon:        { fontSize: 20, opacity: 0.5 },
  iconActive:  { opacity: 1 },
  label:       { fontSize: 10, fontWeight: '600', color: C.textMuted },
  labelActive: { color: C.brand },
});

function TipTitle({ title }: { title: string }) {
  return (
    <View>
      <Text style={{ fontWeight: '700', fontSize: 17, color: C.text }}>{title}</Text>
      <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>⬇ Pull to refresh</Text>
    </View>
  );
}

const headerStyle = {
  backgroundColor: C.surface,
  ...S.xs,
  shadowOffset: { width: 0, height: 1 },
  elevation: 2,
} as const;

export default function App() {
  return (
    <NotesProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
            tabBarShowLabel: false,
            tabBarStyle: {
              backgroundColor: C.surface,
              borderTopWidth: 0,
              ...S.md,
              shadowOffset: { width: 0, height: -4 },
              height: 68,
              paddingHorizontal: 2,
              paddingBottom: 8,
              paddingTop: 6,
            },
            headerStyle,
            headerTintColor: C.brand,
            headerTitleStyle: { fontWeight: '700', fontSize: 17, color: C.text },
            headerShown: !['Notes', 'Calendar'].includes(route.name),
          })}
        >
          <Tab.Screen name="Notes"      component={NotesScreen} />
          <Tab.Screen name="Calendar"   component={CalendarScreen} />
          <Tab.Screen name="Monitor"    component={MonitorScreen}   options={{ title: 'View' }} />
          <Tab.Screen name="Hours"      component={HoursScreen}     options={{ headerTitle: () => <TipTitle title="Hours" /> }} />
          <Tab.Screen name="Files"      component={FilesScreen}     options={{ headerTitle: () => <TipTitle title="Files" /> }} />
          <Tab.Screen name="Statistics" component={StatisticsScreen} options={{ headerTitle: () => <TipTitle title="Statistics" /> }} />
          <Tab.Screen name="Settings"   component={SettingsScreen}  options={{ title: 'Setup' }} />
        </Tab.Navigator>
      </NavigationContainer>
    </NotesProvider>
  );
}
