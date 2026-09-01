import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useNotes } from '../services/notesContext';
import { loadConfig } from '../services/storage';
import { DEFAULT_CONFIG, Employee } from '../config/defaults';
import SyncBar from '../components/SyncBar';
import { useColors } from '../services/themeContext';
import { calcDayHours, fmtHours, DayData, DayHours } from '../services/hours';
import { holidayName } from '../services/holidays';
import { S, R, SP, ColorsType } from '../theme';

// ─── layout constants ─────────────────────────────────────────────────────────

const COL_DATE   = 52;
const COL_DAY    = 58;
const COL_BOTTLE = 72;
const BOTTLE_H   = 20;
const ROW_H      = 70;

// ─── types ───────────────────────────────────────────────────────────────────

type HoursMap = Record<string, Record<string, DayData>>;

// ─── helpers ─────────────────────────────────────────────────────────────────

const DAY_ABBR   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getMondayOf(d: Date): Date {
  const r   = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = r.getDay();
  r.setDate(r.getDate() + (dow === 0 ? -6 : 1 - dow));
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

// The day calculation lives in services/hours.ts so the phone, the PC screen
// and the payslip all use one rule.
const calcHours = calcDayHours;
const fmtH = fmtHours;

// ─── sub-components ───────────────────────────────────────────────────────────

function Bottle({ hours, C }: { hours: DayHours; C: ColorsType }) {
  const bottle = React.useMemo(() => makeBottleStyles(C), [C]);
  if (hours.total === 0) {
    return <View style={bottle.outer}><View style={bottle.markers} /></View>;
  }
  const regW = Math.min(COL_BOTTLE - 2, (hours.regular / 8) * (COL_BOTTLE - 2));
  const otW  = Math.min(COL_BOTTLE - 2 - regW, (hours.overtime / 4) * (COL_BOTTLE - 2));
  const hasOT = hours.overtime > 0;
  const label = hasOT
    ? `${fmtH(hours.regular)}+${fmtH(hours.overtime)}`
    : fmtH(hours.total);

  return (
    <View style={bottle.outer}>
      {[0.25, 0.5, 0.75].map(f => (
        <View key={f} style={[bottle.marker, { left: (COL_BOTTLE - 2) * f }]} />
      ))}
      {regW > 0 && <View style={[bottle.fillReg, { width: regW }]} />}
      {otW  > 0 && <View style={[bottle.fillOT,  { width: otW, left: regW }]} />}
      <Text style={[bottle.label, hasOT && bottle.labelOT]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function makeBottleStyles(C: ColorsType) {
  return StyleSheet.create({
    outer:   { width: COL_BOTTLE - 2, height: BOTTLE_H, backgroundColor: C.bg, borderRadius: R.xs, borderWidth: 0.5, borderColor: C.border, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', position: 'relative' },
    markers: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    marker:  { position: 'absolute', top: 0, bottom: 0, width: 0.5, backgroundColor: C.border, opacity: 0.8 },
    fillReg: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,169,157,0.45)', borderRadius: R.xs },
    fillOT:  { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#dc2626aa', borderRadius: R.xs },
    label:   { position: 'relative', zIndex: 5, fontSize: 8, fontWeight: '700', color: C.textSub },
    labelOT: { color: '#900' },
  });
}

// ─── screen ───────────────────────────────────────────────────────────────────

export default function HoursScreen() {
  const { notes, loading, error, lastSync, refresh } = useNotes();
  const [employees, setEmployees] = useState<Employee[]>(DEFAULT_CONFIG.employees);
  const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date()));

  const C = useColors();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  useEffect(() => {
    loadConfig().then(c => setEmployees(c.employees));
  }, []);

  const hoursMap: HoursMap = (notes as any).workingHours ?? {};
  const todayStr = toDateStr(new Date());

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      return { date: d, dateStr: toDateStr(d) };
    }),
  [weekStart]);

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    return `${weekStart.getDate()} ${MONTH_ABBR[weekStart.getMonth()]} – ${end.getDate()} ${MONTH_ABBR[end.getMonth()]} ${end.getFullYear()}`;
  }, [weekStart]);

  const weekTotals = useMemo(() =>
    employees.map(emp => {
      let reg = 0, ot = 0;
      weekDays.forEach(({ date, dateStr }) => {
        const h = calcHours(hoursMap[emp.mac]?.[dateStr], date);
        reg += h.regular;
        ot  += h.overtime;
      });
      return { name: emp.name, regular: reg, overtime: ot };
    }),
  [employees, weekDays, hoursMap]);

  const tableW = COL_DATE + employees.length * (COL_DAY + COL_BOTTLE);

  return (
    <View style={styles.container}>
      <SyncBar lastSync={lastSync} loading={loading} error={error} />

      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} colors={[C.brand]} tintColor={C.brand} />}
        contentContainerStyle={{ flex: 1 }}
      >
        <View style={styles.weekNav}>
          <TouchableOpacity onPress={() => setWeekStart(d => addDays(d, -7))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.weekLabel}>{weekLabel}</Text>
          <TouchableOpacity onPress={() => setWeekStart(d => addDays(d, 7))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ width: tableW }}>

          <View style={styles.headerRow}>
            <View style={[styles.dateCol, styles.hCell]} />
            {employees.map(emp => (
              <View key={emp.name} style={[styles.empGroup, styles.hCell, styles.hCellEmp]}>
                <View style={{ width: COL_DAY }} />
                <View style={{ width: COL_BOTTLE, alignItems: 'center' }}>
                  <Text style={styles.empName}>{emp.name}</Text>
                </View>
              </View>
            ))}
          </View>

          {weekDays.map(({ date, dateStr }) => {
            const isToday   = dateStr === todayStr;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const holiday   = holidayName(date);

            return (
              <View
                key={dateStr}
                style={[
                  styles.dataRow,
                  isToday   && styles.dataRowToday,
                  isWeekend && !isToday && styles.dataRowWeekend,
                  holiday   && !isToday && styles.dataRowHoliday,
                ]}
              >
                <View style={[styles.dateCol, styles.dateCell]}>
                  <Text style={[
                    styles.dayAbbr,
                    isToday && styles.todayAccent,
                    isWeekend && !isToday && styles.weekendAccent,
                    holiday && !isToday && styles.holidayAccent,
                  ]}>
                    {DAY_ABBR[date.getDay()]}
                  </Text>
                  <Text style={[
                    styles.dayNum,
                    isToday && styles.todayAccent,
                    isWeekend && !isToday && styles.weekendAccent,
                    holiday && !isToday && styles.holidayAccent,
                  ]}>
                    {date.getDate()}
                  </Text>
                  {holiday && <Text style={styles.holidayTag} numberOfLines={1}>HOL</Text>}
                </View>

                {employees.map(emp => {
                  const h = calcHours(hoursMap[emp.mac]?.[dateStr], date);
                  return (
                    <View key={emp.name} style={styles.empGroup}>
                      <View style={[styles.daySubCol, { width: COL_DAY }]}>
                        {h.start ? (
                          <>
                            <Text style={styles.timeVal}>{h.start}</Text>
                            <Text style={styles.timeSep}>–</Text>
                            <Text style={styles.timeVal}>{h.end ?? '…'}</Text>
                          </>
                        ) : (
                          <Text style={styles.noData}>—</Text>
                        )}
                      </View>
                      <View style={[styles.bottleSubCol, { width: COL_BOTTLE }]}>
                        <Bottle hours={h} C={C} />
                        {h.battery && (
                          <Text style={styles.battery}>🔋{h.battery}</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}

          <View style={styles.totalRow}>
            <View style={[styles.dateCol, styles.totalDateCell]}>
              <Text style={styles.totalLabel}>Σ</Text>
            </View>
            {weekTotals.map(t => (
              <View key={t.name} style={[styles.empGroup, styles.totalEmpCell]}>
                <View style={{ width: COL_DAY, alignItems: 'center' }}>
                  <Text style={styles.totalHours}>{fmtH(t.regular)}</Text>
                  {t.overtime > 0 && (
                    <Text style={styles.totalOT}>+{fmtH(t.overtime)}</Text>
                  )}
                </View>
                <View style={{ width: COL_BOTTLE }} />
              </View>
            ))}
          </View>

        </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

function makeStyles(C: ColorsType) {
  return StyleSheet.create({
    container:      { flex: 1, backgroundColor: C.bg },

    weekNav:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.md, paddingVertical: SP.sm, backgroundColor: C.surface, borderBottomWidth: 0.5, borderBottomColor: C.borderLight },
    navArrow:       { fontSize: 28, color: C.brand },
    weekLabel:      { fontSize: 13, fontWeight: '600', color: C.text },

    headerRow:      { flexDirection: 'row', backgroundColor: C.surfaceAlt, borderBottomWidth: 0.5, borderBottomColor: C.border },
    hCell:          { paddingVertical: 8, justifyContent: 'center', alignItems: 'center' },
    hCellEmp:       { borderLeftWidth: 0.5, borderLeftColor: C.border },
    empName:        { fontSize: 12, fontWeight: '700', color: C.textSub },

    dataRow:        { flexDirection: 'row', minHeight: ROW_H, borderBottomWidth: 0.5, borderBottomColor: C.borderLight, backgroundColor: C.surface },
    dataRowToday:   { backgroundColor: C.brandPale },
    dataRowWeekend: { backgroundColor: C.surfaceAlt },
    dataRowHoliday: { backgroundColor: C.surfaceAlt },

    dateCol:        { width: COL_DATE },
    dateCell:       { alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
    dayAbbr:        { fontSize: 10, fontWeight: '700', color: C.textHint, textTransform: 'uppercase' },
    dayNum:         { fontSize: 22, fontWeight: '700', color: C.textHint, lineHeight: 26 },
    todayAccent:    { color: C.brand },
    weekendAccent:  { color: '#C0A0A0' },
    holidayAccent:  { color: '#dc2626' },
    holidayTag:     { fontSize: 7, fontWeight: '700', color: '#dc2626', letterSpacing: 0.4 },

    empGroup:       { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 0.5, borderLeftColor: C.borderLight },
    daySubCol:      { alignItems: 'center', justifyContent: 'center', paddingVertical: 4, gap: 1 },
    bottleSubCol:   { alignItems: 'center', justifyContent: 'center', gap: 3 },
    timeVal:        { fontSize: 10, color: C.textSub, fontWeight: '500' },
    timeSep:        { fontSize: 8, color: C.textHint },
    noData:         { fontSize: 14, color: C.border },
    battery:        { fontSize: 8, color: C.textMuted },

    totalRow:       { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surfaceAlt },
    totalDateCell:  { width: COL_DATE, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
    totalLabel:     { fontSize: 16, fontWeight: '700', color: C.textMuted },
    totalEmpCell:   { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 0.5, borderLeftColor: C.border, paddingVertical: 8 },
    totalHours:     { fontSize: 13, fontWeight: '700', color: C.text, textAlign: 'center' },
    totalOT:        { fontSize: 10, color: C.overtime, fontWeight: '600', textAlign: 'center' },
  });
}
