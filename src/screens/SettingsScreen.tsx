import React, { useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { loadConfig, saveConfig } from '../services/storage';
import { useNotes } from '../services/notesContext';
import { resolveEmployees, isUnnamed } from '../services/employees';
import { DEFAULT_CONFIG, AppConfig } from '../config/defaults';
import { useColors, useThemeCtx } from '../services/themeContext';
import { S, R, SP, ColorsType } from '../theme';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const C = useColors();
  const { setMode, mode } = useThemeCtx();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [saved,  setSaved]  = useState(false);

  const { notes } = useNotes();

  useEffect(() => {
    loadConfig().then(cfg => {
      // Show every beacon that has synced hours, not just the ones already
      // named, so a fresh install has something to put names against.
      setConfig({ ...cfg, employees: resolveEmployees(cfg.employees, notes) });
    });
  }, [notes]);

  function updateEmployeeName(index: number, name: string) {
    const employees = [...config.employees];
    employees[index] = { ...employees[index], name };
    setConfig({ ...config, employees });
  }

  function updatePat(pat: string) {
    setConfig({ ...config, github: { ...config.github, pat } });
  }

  function updateRepo(repo: string) {
    setConfig({ ...config, github: { ...config.github, repo } });
  }

  function updateInterval(val: string) {
    const n = parseInt(val, 10);
    if (!isNaN(n)) setConfig({ ...config, sync: { intervalMinutes: n } });
  }

  const handleSave = useCallback(async () => {
    await saveConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [config]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={[styles.saveBtn, saved && styles.saveBtnDone]}
          onPress={handleSave}
          activeOpacity={0.7}
        >
          <Text style={[styles.saveBtnText, saved && styles.saveBtnTextDone]}>
            {saved ? 'Saved ✓' : 'Save'}
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleSave, saved, styles]);


  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <Text style={styles.section}>Employees</Text>
      <View style={styles.card}>
        {config.employees.length === 0 ? (
          <Text style={styles.hint}>
            No beacons found yet. Set your token and repository below, then pull to
            refresh on the Hours tab — anyone with recorded hours will appear here
            to be named.
          </Text>
        ) : config.employees.map((emp, i) => (
          <View key={emp.mac} style={[styles.fieldRow, i > 0 && styles.fieldSep]}>
            <Text style={styles.mac}>{emp.mac}</Text>
            <TextInput
              style={styles.input}
              value={isUnnamed(emp) ? '' : emp.name}
              onChangeText={name => updateEmployeeName(i, name)}
              placeholder={`Name for ${emp.mac}`}
              placeholderTextColor={C.textHint}
            />
          </View>
        ))}
      </View>

      <Text style={styles.section}>GitHub</Text>
      <View style={styles.card}>
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Repository</Text>
          <TextInput
            style={styles.input}
            value={config.github.repo}
            onChangeText={updateRepo}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="e.g. Synch"
            placeholderTextColor={C.textHint}
          />
          <Text style={styles.hint}>Owner: {config.github.owner}</Text>
        </View>
        <View style={[styles.fieldRow, styles.fieldSep]}>
          <Text style={styles.label}>Personal Access Token</Text>
          <TextInput
            style={styles.input}
            value={config.github.pat}
            onChangeText={updatePat}
            secureTextEntry
            autoCapitalize="none"
            placeholderTextColor={C.textHint}
          />
        </View>
      </View>

      <Text style={styles.section}>Sync</Text>
      <View style={styles.card}>
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Interval (minutes)</Text>
          <TextInput
            style={styles.input}
            value={String(config.sync.intervalMinutes)}
            onChangeText={updateInterval}
            keyboardType="numeric"
            placeholderTextColor={C.textHint}
          />
        </View>
      </View>

      <Text style={styles.section}>Appearance</Text>
      <View style={styles.card}>
        <View style={[styles.fieldRow, styles.themeRow]}>
          {(['light', 'dark', 'system'] as const).map(m => {
            const active = mode === m;
            const icon   = m === 'light' ? '☀︎' : m === 'dark' ? '☾︎' : '◐';
            const label  = m === 'light' ? 'Light' : m === 'dark' ? 'Dark' : 'Auto';
            return (
              <TouchableOpacity
                key={m}
                style={[styles.themeBtn, active && styles.themeBtnActive]}
                onPress={() => setMode(m)}
                activeOpacity={0.7}
              >
                <Text style={[styles.themeIcon, active && styles.themeIconActive]}>{icon}</Text>
                <Text style={[styles.themeLabel, active && styles.themeLabelActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

    </ScrollView>
  );
}

function makeStyles(C: ColorsType) {
  return StyleSheet.create({
    container:       { flex: 1, backgroundColor: C.bg },
    content:         { padding: SP.md, paddingBottom: SP.xl },

    section:         { fontSize: 11, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: SP.lg, marginBottom: SP.sm },

    card:            { backgroundColor: C.surface, borderRadius: R.md, ...S.sm, overflow: 'hidden' },
    fieldRow:        { padding: SP.md },
    fieldSep:        { borderTopWidth: 0.5, borderTopColor: C.borderLight },

    label:           { fontSize: 12, color: C.textSub, fontWeight: '600', marginBottom: 6 },
    mac:             { fontSize: 11, color: C.textMuted, marginBottom: 4, fontFamily: 'monospace' },
    input:           { borderWidth: 1, borderColor: C.border, borderRadius: R.sm, padding: 10, fontSize: 14, color: C.text, backgroundColor: C.surfaceAlt },
    hint:            { fontSize: 11, color: C.textMuted, marginTop: 5 },

    themeRow:        { flexDirection: 'row', gap: 10 },
    themeBtn:        { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: R.sm, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surfaceAlt },
    themeBtnActive:  { borderColor: C.brand, backgroundColor: C.brandPale },
    themeIcon:       { fontSize: 22, color: C.textMuted, marginBottom: 4 },
    themeIconActive: { color: C.brand },
    themeLabel:      { fontSize: 11, fontWeight: '600', color: C.textMuted },
    themeLabelActive:{ color: C.brand },

    saveBtn:         { marginRight: 8, paddingHorizontal: 10, paddingVertical: 4,
                       backgroundColor: C.surface, borderRadius: R.sm,
                       borderWidth: 1.5, borderColor: C.brand },
    saveBtnDone:     { borderColor: C.success },
    saveBtnText:     { color: C.text, fontWeight: '600', fontSize: 13 },
    saveBtnTextDone: { color: C.success },
  });
}
