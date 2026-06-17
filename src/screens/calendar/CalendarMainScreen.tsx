import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNotes, getNoteRecords } from '../../services/notesContext';
import { CalendarStackParams } from '../CalendarScreen';
import SyncBar from '../../components/SyncBar';
import { useColors } from '../../services/themeContext';
import { R, SP, ColorsType } from '../../theme';

type Nav = NativeStackNavigationProp<CalendarStackParams, 'CalendarMain'>;

const DAY_NAMES   = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export default function CalendarMainScreen() {
  const nav = useNavigation<Nav>();
  const { notes, loading, error, lastSync, refresh } = useNotes();

  const C = useColors();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const dotMap = useMemo(() => {
    const map = new Map<string, { color: string; key: string }[]>();
    getNoteRecords(notes).forEach(({ record }) => {
      parseWorkSlots(record).forEach(({ slotKey, dateStr: ds, color }) => {
        if (!ds) return;
        if (!map.has(ds)) map.set(ds, []);
        map.get(ds)!.push({ color, key: slotKey });
      });
    });
    return map;
  }, [notes]);

  const weeks   = buildMonth(year, month);
  const todayDs = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  return (
    <View style={styles.container}>
      <SyncBar lastSync={lastSync} loading={loading} error={error} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} colors={[C.brand]} tintColor={C.brand} />}
      >
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{MONTH_NAMES[month]} {year}</Text>
          <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          {DAY_NAMES.map((d, i) => (
            <Text key={d} style={[styles.dayName, (i >= 5) && styles.dayNameWeekend]}>{d}</Text>
          ))}
        </View>

        {weeks.map((week, wi) => (
          <View key={wi} style={styles.row}>
            {week.map((day, di) => {
              if (!day) return <View key={di} style={styles.cell} />;

              const ds      = toDateStr(year, month + 1, day);
              const dots    = dotMap.get(ds) ?? [];
              const isToday = ds === todayDs;
              const isWeekend = di >= 5;

              return (
                <TouchableOpacity
                  key={di}
                  style={[styles.cell, isToday && styles.cellToday]}
                  onPress={() => nav.navigate('DayView', { dateStr: ds })}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayNum, isToday && styles.dayNumToday, isWeekend && !isToday && styles.dayNumWeekend]}>
                    {day}
                  </Text>
                  {dots.length > 0 && (
                    <View style={styles.dotGrid}>
                      {dots.slice(0, 6).map(({ key, color }) => (
                        <View key={key} style={[styles.dot, { backgroundColor: dotColor(color, C.brand) }]} />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── exported helpers ────────────────────────────────────────────────────────

export function toDateStr(year: number, month: number, day: number): string {
  return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
}

export type WorkSlot = { slotKey: string; dateStr: string; color: string; status: string };

/**
 * Parse all work slots from a NoteRecord.
 * `work` = "TagUID1;TagUID2;" — one slotKey per assignment.
 * `workColor` = "TagUID1:EF3340;TagUID2:00A99D;" — per-slot color.
 * `createdForDate` = "TagUID1:20260615;TagUID2:20260614;" — per-slot date.
 * `status` = "TagUID1:unchecked;TagUID2:unchecked;" — per-slot state.
 */
export function parseWorkSlots(record: { work?: string; workColor?: string; createdForDate?: string; status?: string }): WorkSlot[] {
  const work = record.work ?? '';
  if (!work) return [];
  return work.split(';').filter(Boolean).map(slotKey => {
    const dateMatch   = new RegExp(escRe(slotKey) + ':(\\d{8});').exec(record.createdForDate ?? '');
    const colorMatch  = new RegExp(escRe(slotKey) + ':([^;]+);').exec(record.workColor ?? '');
    const statusMatch = new RegExp(escRe(slotKey) + ':([^;]+);').exec(record.status ?? '');
    return {
      slotKey,
      dateStr: dateMatch  ? dateMatch[1]  : '',
      color:   colorMatch ? colorMatch[1] : 'none',
      status:  statusMatch ? statusMatch[1] : 'unchecked',
    };
  });
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function generateSlotKey(tag: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let uid = 'UID';
  for (let i = 0; i < 4; i++) uid += chars[Math.floor(Math.random() * chars.length)];
  return `${tag}${uid}`;
}

export function extractAllDateStrs(record: { work?: string; createdForDate?: string }): string[] {
  return parseWorkSlots(record).map(s => s.dateStr).filter(Boolean);
}

export function formatDayTitle(dateStr: string): string {
  const y  = parseInt(dateStr.slice(0, 4), 10);
  const mo = parseInt(dateStr.slice(4, 6), 10) - 1;
  const d  = parseInt(dateStr.slice(6, 8), 10);
  return new Date(y, mo, d).toLocaleDateString([], {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function buildMonth(year: number, month: number): (number | null)[][] {
  const firstDay     = new Date(year, month, 1).getDay();
  const leadingNulls = (firstDay + 6) % 7;
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(leadingNulls).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function dotColor(color: string, brand: string): string {
  if (!color || color === 'none' || color === 'FFFFFF' || color === 'transparent') return brand;
  return `#${color}`;
}

// ─── styles ─────────────────────────────────────────────────────────────────

function makeStyles(C: ColorsType) {
  return StyleSheet.create({
    container:      { flex: 1, backgroundColor: C.bg },
    content:        { paddingHorizontal: 4, paddingBottom: SP.lg },
    monthRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.sm, paddingVertical: SP.md },
    navArrow:       { fontSize: 32, color: C.brand, paddingHorizontal: 10 },
    monthTitle:     { fontSize: 20, fontWeight: '700', color: C.text },
    row:            { flexDirection: 'row' },
    dayName:        { flex: 1, textAlign: 'center', fontSize: 12, color: C.textMuted, fontWeight: '600', paddingVertical: SP.sm },
    dayNameWeekend: { color: '#C0A0A0' },
    cell:           { flex: 1, alignItems: 'center', paddingVertical: 10, minHeight: 72, borderRadius: R.sm },
    cellToday:      { backgroundColor: C.brandLight },
    dayNum:         { fontSize: 17, color: C.textSub },
    dayNumToday:    { color: C.brand, fontWeight: '700' },
    dayNumWeekend:  { color: '#C0A0A0' },
    dotGrid:        { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 2, marginTop: 5, maxWidth: 36 },
    dot:            { width: 5, height: 5, borderRadius: 3 },
  });
}
