import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet, TouchableOpacity, Image, ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotesProvider } from './src/services/notesContext';
import { ThemeProvider, useColors } from './src/services/themeContext';
import NotesScreen      from './src/screens/NotesScreen';
import CalendarScreen   from './src/screens/CalendarScreen';
import MonitorScreen    from './src/screens/MonitorScreen';
import HoursScreen      from './src/screens/HoursScreen';
import FilesScreen      from './src/screens/FilesScreen';
import StatisticsScreen from './src/screens/StatisticsScreen';
import SettingsScreen   from './src/screens/SettingsScreen';
import { S, R, ColorsType } from './src/theme';

const Tab = createBottomTabNavigator();

const PICTO: Record<string, ImageSourcePropType> = {
  Notes:      require('./pictograms/notes.png'),
  Calendar:   require('./pictograms/calendar.png'),
  Monitor:    require('./pictograms/monitor.png'),
  Hours:      require('./pictograms/jours.png'),
  Files:      require('./pictograms/files.png'),
  Statistics: require('./pictograms/stats.png'),
  Settings:   require('./pictograms/setup.png'),
};

const SHORT: Record<string, string> = {
  Notes: 'Notes', Calendar: 'Rota', Monitor: 'View',
  Hours: 'Hours', Files: 'Files', Statistics: 'Stats', Settings: 'Setup',
};

const TAB_ROW_HEIGHT = 56;

function TopTabBar({ state, navigation, onHeightChange }: BottomTabBarProps & { onHeightChange: (h: number) => void }) {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const bar = React.useMemo(() => makeBarStyles(C), [C]);

  return (
    <View
      style={[bar.bar, { paddingTop: insets.top }]}
      onLayout={e => onHeightChange(e.nativeEvent.layout.height)}
    >
      <View style={bar.row}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          return (
            <TouchableOpacity
              key={route.key}
              style={bar.item}
              onPress={() => navigation.navigate(route.name)}
              activeOpacity={0.65}
            >
              <Image
                source={PICTO[route.name]}
                style={[bar.icon, { opacity: focused ? 1 : 0.4 }]}
                resizeMode="stretch"
              />
              <Text style={[bar.label, focused && bar.labelActive]} numberOfLines={1}>
                {SHORT[route.name]}
              </Text>
              <View style={[bar.indicator, focused && bar.indicatorActive]} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function TipTitle({ title, sub }: { title: string; sub?: string }) {
  const C = useColors();
  return (
    <View>
      <Text style={{ fontWeight: '700', fontSize: 17, color: C.text }}>{title}</Text>
      <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>{sub ?? '⬇ Pull to refresh'}</Text>
    </View>
  );
}

function AppNavigator() {
  const [barHeight, setBarHeight] = useState(TAB_ROW_HEIGHT + 24);
  const C = useColors();
  const headerStyle = React.useMemo(() => ({
    backgroundColor: C.surface,
    ...S.xs,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  }), [C]);

  return (
    <NavigationContainer>
      <Tab.Navigator
        tabBar={(props) => <TopTabBar {...props} onHeightChange={setBarHeight} />}
        sceneContainerStyle={{ paddingTop: barHeight }}
        screenOptions={({ route }) => ({
          headerStyle,
          headerTintColor: C.brand,
          headerTitleStyle: { fontWeight: '700', fontSize: 17, color: C.text },
          headerShown: !['Notes', 'Calendar'].includes(route.name),
          headerRightContainerStyle: { paddingRight: 0 },
        })}
      >
        <Tab.Screen name="Notes"      component={NotesScreen} />
        <Tab.Screen name="Calendar"   component={CalendarScreen} />
        <Tab.Screen name="Monitor"    component={MonitorScreen}   options={{ title: 'View' }} />
        <Tab.Screen name="Hours"      component={HoursScreen}     options={{ headerTitle: () => <TipTitle title="Hours" /> }} />
        <Tab.Screen name="Files"      component={FilesScreen}     options={{ headerTitle: () => <TipTitle title="Files" sub="Files larger than 47 MB will not be synced" /> }} />
        <Tab.Screen name="Statistics" component={StatisticsScreen} options={{ headerTitle: () => <TipTitle title="Statistics" /> }} />
        <Tab.Screen name="Settings"   component={SettingsScreen}  options={{ title: 'Setup' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <NotesProvider>
        <AppNavigator />
      </NotesProvider>
    </ThemeProvider>
  );
}

function makeBarStyles(C: ColorsType) {
  return StyleSheet.create({
    bar:            { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
                      backgroundColor: C.surface, elevation: 3,
                      shadowColor: '#1A2B4B', shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08, shadowRadius: 6,
                      borderBottomWidth: 1, borderBottomColor: C.border },
    row:            { flexDirection: 'row', height: TAB_ROW_HEIGHT },
    item:           { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
    icon:           { width: 22, height: 22 },
    label:          { fontSize: 10, fontWeight: '500', color: C.textMuted, letterSpacing: 0.2 },
    labelActive:    { color: C.brand, fontWeight: '600' },
    indicator:      { position: 'absolute', bottom: 0, left: '20%', right: '20%',
                      height: 2, borderRadius: 1, backgroundColor: 'transparent' },
    indicatorActive:{ backgroundColor: C.brand },
  });
}
