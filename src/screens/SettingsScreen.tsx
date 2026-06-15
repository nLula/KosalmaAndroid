import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { loadConfig, saveConfig } from '../services/storage';
import { DEFAULT_CONFIG, AppConfig } from '../config/defaults';
import { C, S, R, SP } from '../theme';

export default function SettingsScreen() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadConfig().then(setConfig);
  }, []);

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

  async function handleSave() {
    await saveConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <Text style={styles.section}>Employees</Text>
      <View style={styles.card}>
        {config.employees.map((emp, i) => (
          <View key={emp.mac} style={[styles.fieldRow, i > 0 && styles.fieldSep]}>
            <Text style={styles.mac}>{emp.mac}</Text>
            <TextInput
              style={styles.input}
              value={emp.name}
              onChangeText={name => updateEmployeeName(i, name)}
              placeholder="Name"
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

      <TouchableOpacity style={[styles.btn, saved && styles.btnSaved]} onPress={handleSave}>
        <Text style={styles.btnText}>{saved ? 'Saved ✓' : 'Save Settings'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },
  content:    { padding: SP.md, paddingBottom: SP.xl },

  section:    { fontSize: 11, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: SP.lg, marginBottom: SP.sm },

  card:       { backgroundColor: C.surface, borderRadius: R.md, ...S.sm, overflow: 'hidden' },
  fieldRow:   { padding: SP.md },
  fieldSep:   { borderTopWidth: 0.5, borderTopColor: C.borderLight },

  label:      { fontSize: 12, color: C.textSub, fontWeight: '600', marginBottom: 6 },
  mac:        { fontSize: 11, color: C.textMuted, marginBottom: 4, fontFamily: 'monospace' },
  input:      { borderWidth: 1, borderColor: C.border, borderRadius: R.sm, padding: 10, fontSize: 14, color: C.text, backgroundColor: C.surfaceAlt },
  hint:       { fontSize: 11, color: C.textMuted, marginTop: 5 },

  btn:        { marginTop: SP.xl, backgroundColor: C.brand, borderRadius: R.md, padding: 15, alignItems: 'center', ...S.sm },
  btnSaved:   { backgroundColor: C.success },
  btnText:    { color: C.white, fontWeight: '700', fontSize: 15 },
});
