import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, FlatList, Modal, Dimensions, RefreshControl,
} from 'react-native';
import { loadConfig } from '../services/storage';
import { fetchStatistics } from '../services/githubApi';
import { useColors } from '../services/themeContext';
import { S, R, SP, ColorsType } from '../theme';

// ─── constants ───────────────────────────────────────────────────────────────

const DISPLAY_FIELDS = [
  'Thickness (mm)',
  'Total area slab (m^2)',
  'Piece Area (m^2)',
  'Slab used (%)',
  'Slab used Total (%)',
  'Cut length (m)',
  'Cut area (m^2)',
  'Slab duration time (min)',
  'Duration processing (min)',
  'Slab volume (m^3)',
  'Machine Travel Distance (m)',
  'Energy Consumption (kWh)',
];

const BAR_MAX_H   = 130;
const BAR_LABEL_H = 42;
const SCREEN_W    = Dimensions.get('window').width;

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: string): string {
  if (d.length !== 8) return d;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d.slice(6, 8))} ${months[parseInt(d.slice(4, 6)) - 1]} ${d.slice(0, 4)}`;
}

function fmtNum(v: number): string {
  return v % 1 === 0 ? String(v) : v.toFixed(2);
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SummaryTile({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

type PickerModalProps = {
  visible: boolean;
  title: string;
  items: string[];
  selected?: string;
  renderItem: (item: string) => string;
  onSelect: (item: string) => void;
  onClose: () => void;
  styles: ReturnType<typeof makeStyles>;
};

function PickerModal({ visible, title, items, selected, renderItem, onSelect, onClose, styles }: PickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.sheetClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={items}
          keyExtractor={i => i}
          style={{ maxHeight: 400 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.sheetItem, selected === item && styles.sheetItemActive]}
              onPress={() => onSelect(item)}
            >
              <Text style={[styles.sheetItemText, selected === item && styles.sheetItemTextActive]}>
                {renderItem(item)}
              </Text>
              {selected === item && <Text style={styles.sheetCheck}>✓</Text>}
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.sheetEmpty}>No items available</Text>}
        />
      </View>
    </Modal>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function StatisticsScreen() {
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [stats,      setStats]      = useState<Record<string, any>>({});

  const [machine,       setMachine]       = useState('');
  const [dateFrom,      setDateFrom]      = useState('');
  const [dateTo,        setDateTo]        = useState('');
  const [selectedWorks, setSelectedWorks] = useState<Set<string>>(new Set());
  const [hiddenFields,  setHiddenFields]  = useState<Set<string>>(new Set());

  const [showMachine,   setShowMachine]   = useState(false);
  const [showDateFrom,  setShowDateFrom]  = useState(false);
  const [showDateTo,    setShowDateTo]    = useState(false);

  const C = useColors();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const config = await loadConfig();
      const data   = await fetchStatistics(config);
      setStats(data);

      const machines = Object.keys(data).filter(k => k !== 'lastchanged');
      if (machines.length > 0) {
        const m     = machines[0];
        const dates = Object.keys(data[m]).filter(k => k !== 'lastchanged').sort();
        const last  = dates[dates.length - 1] ?? '';
        setMachine(m);
        setDateFrom(last);
        setDateTo(last);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const machines = useMemo(
    () => Object.keys(stats).filter(k => k !== 'lastchanged'),
    [stats],
  );

  const availableDates = useMemo(() => {
    if (!machine || !stats[machine]) return [];
    return Object.keys(stats[machine]).filter(k => k !== 'lastchanged').sort();
  }, [stats, machine]);

  const allWorksData = useMemo<Record<string, Record<string, string>>>(() => {
    if (!machine || !stats[machine]) return {};
    const result: Record<string, Record<string, string>> = {};
    for (const period of availableDates) {
      if (period < dateFrom || period > dateTo) continue;
      const works = stats[machine][period]?.StatisticsId ?? {};
      for (const [wid, data] of Object.entries(works)) {
        result[wid] = { ...(data as any), _period: period };
      }
    }
    return result;
  }, [stats, machine, availableDates, dateFrom, dateTo]);

  const workIds = useMemo(() => Object.keys(allWorksData).sort((a, b) => +a - +b), [allWorksData]);

  const worksToDisplay = useMemo(
    () => selectedWorks.size > 0 ? workIds.filter(id => selectedWorks.has(id)) : workIds,
    [workIds, selectedWorks],
  );

  const summary = useMemo(() => {
    let energy = 0, duration = 0, area = 0;
    for (const id of worksToDisplay) {
      const d = allWorksData[id] ?? {};
      energy   += parseFloat(d['Energy Consumption (kWh)'])   || 0;
      duration += parseFloat(d['Duration processing (min)'])  || 0;
      area     += parseFloat(d['Piece Area (m^2)'])           || 0;
    }
    return { count: worksToDisplay.length, energy, duration, area };
  }, [worksToDisplay, allWorksData]);

  function selectMachine(m: string) {
    const dates = Object.keys(stats[m] ?? {}).filter(k => k !== 'lastchanged').sort();
    const last  = dates[dates.length - 1] ?? '';
    setMachine(m);
    setDateFrom(last);
    setDateTo(last);
    setSelectedWorks(new Set());
    setShowMachine(false);
  }

  function toggleWork(id: string) {
    setSelectedWorks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleField(f: string) {
    setHiddenFields(prev => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f); else next.add(f);
      return next;
    });
  }

  function renderChart(field: string) {
    if (worksToDisplay.length === 0) return null;

    const values = worksToDisplay.map(id => ({
      id,
      value: parseFloat(allWorksData[id]?.[field]) || 0,
    }));

    const maxVal = Math.max(...values.map(v => v.value), 0.0001);
    const multi  = values.length > 1;

    const totalPad = 32;
    const rawBarW  = Math.floor((SCREEN_W - totalPad) / values.length);
    const barW     = Math.min(Math.max(rawBarW, 32), 72);

    return (
      <View key={field} style={styles.chartPanel}>
        <Text style={styles.chartTitle} numberOfLines={1}>{field}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScroll}>
          <View style={{ flexDirection: 'row', height: BAR_MAX_H + BAR_LABEL_H }}>
            {values.map(({ id, value }) => {
              const barH = multi
                ? Math.max((value / maxVal) * BAR_MAX_H, value > 0 ? 6 : 2)
                : BAR_MAX_H;
              return (
                <View key={id} style={[styles.barCol, { width: barW }]}>
                  <View style={{ flex: 1 }} />
                  <View style={[styles.bar, { height: barH, width: barW * 0.65 }]}>
                    {!multi && value > 0 && (
                      <Text style={styles.barValueInside} numberOfLines={3}>{fmtNum(value)}</Text>
                    )}
                  </View>
                  {multi && (
                    <Text style={styles.barValueBelow} numberOfLines={1}>
                      {value > 0 ? fmtNum(value) : '—'}
                    </Text>
                  )}
                  <Text style={styles.barWorkId} numberOfLines={1}>#{id}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.brand} />
        <Text style={styles.loadingText}>Loading statistics…</Text>
        <Text style={styles.loadingHint}>This may take a moment</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>⚠</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (machines.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No statistics data found.</Text>
      </View>
    );
  }

  const fieldsToShow = DISPLAY_FIELDS.filter(f => !hiddenFields.has(f));

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.brand]} tintColor={C.brand} />}
      >

        {machines.length > 1 ? (
          <TouchableOpacity style={styles.machineBtn} onPress={() => setShowMachine(true)}>
            <Text style={styles.machineBtnText}>{machine} ▾</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.machineTag}>
            <Text style={styles.machineTagText}>{machine}</Text>
          </View>
        )}

        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDateFrom(true)}>
            <Text style={styles.dateBtnLabel}>From</Text>
            <Text style={styles.dateBtnDate}>{fmtDate(dateFrom)}</Text>
          </TouchableOpacity>
          <Text style={styles.dateSep}>→</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDateTo(true)}>
            <Text style={styles.dateBtnLabel}>To</Text>
            <Text style={styles.dateBtnDate}>{fmtDate(dateTo)}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <SummaryTile label="Works"    value={String(summary.count)} styles={styles} />
          <SummaryTile label="Energy"   value={`${summary.energy.toFixed(2)} kWh`} styles={styles} />
          <SummaryTile label="Duration" value={`${summary.duration.toFixed(0)} min`} styles={styles} />
          <SummaryTile label="Area"     value={`${summary.area.toFixed(2)} m²`} styles={styles} />
        </View>

        {workIds.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Works  <Text style={styles.sectionHint}>(tap to filter)</Text></Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {workIds.map(id => (
                <TouchableOpacity
                  key={id}
                  style={[styles.chip, selectedWorks.has(id) && styles.chipActive]}
                  onPress={() => toggleWork(id)}
                >
                  <Text style={[styles.chipText, selectedWorks.has(id) && styles.chipTextActive]}>#{id}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Fields  <Text style={styles.sectionHint}>(tap to hide)</Text></Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {DISPLAY_FIELDS.map(f => {
              const shown = !hiddenFields.has(f);
              return (
                <TouchableOpacity
                  key={f}
                  style={[styles.chip, shown && styles.chipActive]}
                  onPress={() => toggleField(f)}
                >
                  <Text style={[styles.chipText, shown && styles.chipTextActive]} numberOfLines={1}>{f}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {worksToDisplay.length === 0 ? (
          <Text style={styles.emptyText}>No data in selected range.</Text>
        ) : fieldsToShow.length === 0 ? (
          <Text style={styles.emptyText}>All fields hidden. Tap a field chip to show it.</Text>
        ) : (
          fieldsToShow.map(field => renderChart(field))
        )}

      </ScrollView>

      <PickerModal
        visible={showMachine}
        title="Select machine"
        items={machines}
        selected={machine}
        renderItem={m => m}
        onSelect={selectMachine}
        onClose={() => setShowMachine(false)}
        styles={styles}
      />

      <PickerModal
        visible={showDateFrom}
        title="From date"
        items={availableDates.filter(d => d <= dateTo)}
        selected={dateFrom}
        renderItem={fmtDate}
        onSelect={d => { setDateFrom(d); setSelectedWorks(new Set()); setShowDateFrom(false); }}
        onClose={() => setShowDateFrom(false)}
        styles={styles}
      />

      <PickerModal
        visible={showDateTo}
        title="To date"
        items={availableDates.filter(d => d >= dateFrom)}
        selected={dateTo}
        renderItem={fmtDate}
        onSelect={d => { setDateTo(d); setSelectedWorks(new Set()); setShowDateTo(false); }}
        onClose={() => setShowDateTo(false)}
        styles={styles}
      />
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

function makeStyles(C: ColorsType) {
  return StyleSheet.create({
    container:       { flex: 1, backgroundColor: C.bg },
    content:         { paddingBottom: SP.xl },

    center:          { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.lg, backgroundColor: C.bg },
    loadingText:     { marginTop: 14, fontSize: 15, color: C.textSub },
    loadingHint:     { marginTop: 6, fontSize: 12, color: C.textMuted },
    errorIcon:       { fontSize: 36, marginBottom: 12 },
    errorText:       { fontSize: 14, color: C.error, textAlign: 'center', lineHeight: 20 },
    emptyText:       { textAlign: 'center', color: C.textMuted, fontSize: 14, marginTop: 40, lineHeight: 22 },

    machineBtn:      { margin: SP.md, marginBottom: SP.sm, backgroundColor: C.brand, borderRadius: R.md, padding: 12, alignItems: 'center', ...S.sm },
    machineBtnText:  { color: C.white, fontWeight: '700', fontSize: 15 },
    machineTag:      { margin: SP.md, marginBottom: SP.sm, alignItems: 'center' },
    machineTagText:  { fontSize: 16, fontWeight: '600', color: C.brand },

    dateRow:         { flexDirection: 'row', alignItems: 'center', marginHorizontal: SP.md, marginBottom: SP.sm, gap: 8 },
    dateBtn:         { flex: 1, backgroundColor: C.surface, borderRadius: R.sm, borderWidth: 1, borderColor: C.border, padding: 10, ...S.xs },
    dateBtnLabel:    { fontSize: 10, color: C.brand, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    dateBtnDate:     { fontSize: 13, color: C.text, fontWeight: '500', marginTop: 2 },
    dateSep:         { fontSize: 16, color: C.textHint },

    summaryRow:      { flexDirection: 'row', marginHorizontal: SP.md, marginBottom: SP.sm, gap: 6 },
    summaryTile:     { flex: 1, backgroundColor: C.surface, borderRadius: R.sm, padding: 10, alignItems: 'center', ...S.xs },
    summaryValue:    { fontSize: 13, fontWeight: '700', color: C.text, textAlign: 'center' },
    summaryLabel:    { fontSize: 10, color: C.textMuted, marginTop: 2, textAlign: 'center' },

    section:         { marginBottom: SP.sm },
    sectionLabel:    { fontSize: 11, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginHorizontal: SP.md, marginBottom: 6 },
    sectionHint:     { fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
    chips:           { paddingHorizontal: SP.md, gap: 6 },
    chip:            { paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface },
    chipActive:      { borderColor: C.brand, backgroundColor: C.brandLight },
    chipText:        { fontSize: 11, color: C.textMuted },
    chipTextActive:  { color: C.brand, fontWeight: '600' },

    chartPanel:      { marginHorizontal: SP.md, marginBottom: SP.md, backgroundColor: C.surface, borderRadius: R.md, padding: SP.sm + 4, ...S.sm },
    chartTitle:      { fontSize: 12, fontWeight: '600', color: C.textSub, marginBottom: 8 },
    chartScroll:     { paddingBottom: 2 },

    barCol:          { alignItems: 'center', paddingHorizontal: 2 },
    bar:             { backgroundColor: 'rgba(0,169,157,0.50)', borderTopLeftRadius: R.xs, borderTopRightRadius: R.xs, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
    barValueInside:  { fontSize: 10, color: C.white, fontWeight: '600', textAlign: 'center', lineHeight: 13 },
    barValueBelow:   { fontSize: 10, color: C.textSub, marginTop: 3, textAlign: 'center' },
    barWorkId:       { fontSize: 9, color: C.textMuted, fontWeight: '600', marginTop: 1, textAlign: 'center' },

    overlay:         { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet:           { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.surface, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, paddingBottom: 32 },
    sheetHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SP.md, borderBottomWidth: 0.5, borderBottomColor: C.borderLight },
    sheetTitle:      { fontSize: 16, fontWeight: '700', color: C.text },
    sheetClose:      { fontSize: 18, color: C.textHint },
    sheetItem:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SP.md, borderBottomWidth: 0.5, borderBottomColor: C.borderLight },
    sheetItemActive: { backgroundColor: C.brandPale },
    sheetItemText:   { fontSize: 15, color: C.text },
    sheetItemTextActive: { color: C.brand, fontWeight: '600' },
    sheetCheck:      { fontSize: 16, color: C.brand, fontWeight: '700' },
    sheetEmpty:      { padding: 28, textAlign: 'center', color: C.textMuted, fontSize: 13 },
  });
}
