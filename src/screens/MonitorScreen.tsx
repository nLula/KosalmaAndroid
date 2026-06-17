import React, { useRef, useMemo, useEffect, useState, useLayoutEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Modal, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useNotes, getNoteRecords, NoteRecord } from '../services/notesContext';
import { stripMd } from '../utils/stripMd';
import SyncBar from '../components/SyncBar';
import { parseWorkSlots, WorkSlot } from './calendar/CalendarMainScreen';
import { useColors } from '../services/themeContext';
import { S, R, SP, ColorsType } from '../theme';

// ─── constants ───────────────────────────────────────────────────────────────

const RANGE     = 365;
const TODAY_IDX = RANGE;
const EST_H     = 88;

const DAY_ABBR   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── types ───────────────────────────────────────────────────────────────────

type DayEntry  = { dateStr: string; date: Date };
type SlotEntry = { noteId: string; record: NoteRecord; slot: WorkSlot };

// ─── helpers ─────────────────────────────────────────────────────────────────

function buildDates(today: Date): DayEntry[] {
  return Array.from({ length: RANGE * 2 + 1 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (i - RANGE));
    const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return { dateStr: ds, date: d };
  });
}

function noteColor(color: string, brand: string): string {
  if (!color || color === 'none' || color === 'FFFFFF' || color === 'transparent') return brand;
  return `#${color}`;
}

// ─── component ───────────────────────────────────────────────────────────────

export default function MonitorScreen() {
  const navigation = useNavigation();
  const { notes, loading, error, lastSync } = useNotes();
  const listRef = useRef<FlatList<DayEntry>>(null);
  const [showJump,     setShowJump]     = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotEntry | null>(null);

  const C = useColors();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const today = useMemo(() => new Date(), []);
  const dates = useMemo(() => buildDates(today), [today]);

  const slotMap = useMemo(() => {
    const map = new Map<string, SlotEntry[]>();
    getNoteRecords(notes).forEach(({ id, record }) => {
      parseWorkSlots(record).forEach(slot => {
        if (!slot.dateStr) return;
        if (!map.has(slot.dateStr)) map.set(slot.dateStr, []);
        map.get(slot.dateStr)!.push({ noteId: id, record, slot });
      });
    });
    return map;
  }, [notes]);

  useEffect(() => {
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: TODAY_IDX, animated: false, viewPosition: 0.5 });
    }, 120);
    return () => clearTimeout(timer);
  }, []);

  function jumpToToday() {
    listRef.current?.scrollToIndex({ index: TODAY_IDX, animated: true, viewPosition: 0.5 });
    setShowJump(false);
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: showJump ? () => (
        <TouchableOpacity style={styles.todayBtn} onPress={jumpToToday} activeOpacity={0.7}>
          <Text style={styles.todayBtnText}>{'↩︎'} Today</Text>
        </TouchableOpacity>
      ) : undefined,
    });
  }, [navigation, showJump, styles]);

  function onViewableChanged({ viewableItems }: any) {
    const visible = viewableItems.map((v: any) => v.index as number);
    setShowJump(!visible.includes(TODAY_IDX));
  }

  const renderItem = ({ item, index }: { item: DayEntry; index: number }) => {
    const isToday   = index === TODAY_IDX;
    const daySlots  = slotMap.get(item.dateStr) ?? [];
    const d         = item.date;
    const dayName   = DAY_ABBR[d.getDay()];
    const monthName = MONTH_ABBR[d.getMonth()];
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;

    const slotNodes = daySlots.map(entry => {
      const slotBg   = noteColor(entry.slot.color, C.brand);
      const isLight  = entry.slot.color === 'FFF200';
      const tagLabel = (entry.record.tag || '—').slice(0, 4).toUpperCase();
      const sub      = [entry.record.tag, entry.record.project].filter(Boolean).join(' · ');
      return (
        <TouchableOpacity
          key={entry.slot.slotKey}
          style={styles.noteItem}
          onPress={() => setSelectedSlot(entry)}
          activeOpacity={0.7}
        >
          <View style={[styles.noteBadge, { backgroundColor: slotBg, borderColor: slotBg }]}>
            <Text style={[styles.noteBadgeText, { color: isLight ? C.text : C.white }]}>{tagLabel}</Text>
          </View>
          <View style={styles.noteBody}>
            <Text style={styles.noteTitle} numberOfLines={1}>
              {entry.record.header?.replace(/^#+\s*/, '') || '(no title)'}
            </Text>
            {sub ? <Text style={styles.noteSub} numberOfLines={1}>{sub}</Text> : null}
          </View>
        </TouchableOpacity>
      );
    });

    return (
      <View style={[styles.dayRow, isToday && styles.dayRowToday]}>
        <View style={[styles.dateBadge, isToday && styles.dateBadgeToday]}>
          <Text style={[styles.dayName, isToday && styles.dayAccent, isWeekend && !isToday && styles.weekendText]}>
            {dayName}
          </Text>
          <Text style={[styles.dayNum, isToday && styles.dayAccent, isWeekend && !isToday && styles.weekendText]}>
            {d.getDate()}
          </Text>
          <Text style={[styles.monthLabel, isToday && styles.dayAccent]}>
            {monthName}
          </Text>
          {isToday && <View style={styles.todayPill}><Text style={styles.todayPillText}>TODAY</Text></View>}
        </View>

        <View style={styles.notesCol}>
          {daySlots.length === 0 ? (
            <Text style={styles.emptyDay}>—</Text>
          ) : slotNodes}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SyncBar lastSync={lastSync} loading={loading} error={error} />

      <FlatList
        ref={listRef}
        data={dates}
        keyExtractor={item => item.dateStr}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({ length: EST_H, offset: EST_H * index, index })}
        initialScrollIndex={TODAY_IDX}
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0.5 });
          }, 300);
        }}
        onViewableItemsChanged={onViewableChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 10 }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        windowSize={21}
        maxToRenderPerBatch={20}
      />

      <Modal
        visible={!!selectedSlot}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedSlot(null)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedSlot(null)} />
        {selectedSlot && (
          <View style={styles.modalSheet}>
            <View style={[styles.modalAccent, { backgroundColor: noteColor(selectedSlot.slot.color, C.brand) }]} />
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Text style={styles.modalTitle}>
                  {selectedSlot.record.header?.replace(/^#+\s*/, '') || '(no title)'}
                </Text>
                <View style={styles.modalPills}>
                  <View style={styles.tagPill}>
                    <Text style={styles.tagText}>{selectedSlot.record.tag}</Text>
                  </View>
                  {selectedSlot.record.project ? (
                    <Text style={styles.modalProject}>{selectedSlot.record.project}</Text>
                  ) : null}
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedSlot(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
              {selectedSlot.record.description
                ? <Text style={styles.modalDescription}>{stripMd(selectedSlot.record.description)}</Text>
                : <Text style={styles.modalEmpty}>No description.</Text>
              }
            </ScrollView>

            <View style={styles.modalFooter}>
              <Text style={styles.modalMeta}>
                Changed: {selectedSlot.record.lastchanged
                  ? new Date(selectedSlot.record.lastchanged).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'}
              </Text>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

function makeStyles(C: ColorsType) {
  return StyleSheet.create({
    container:       { flex: 1, backgroundColor: C.bg },

    dayRow:          { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 10, minHeight: EST_H },
    dayRowToday:     { backgroundColor: C.brandPale },

    dateBadge:       { width: 58, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2, marginRight: 10 },
    dateBadgeToday:  {},

    dayName:         { fontSize: 11, color: C.textHint, fontWeight: '700', textTransform: 'uppercase' },
    dayNum:          { fontSize: 26, fontWeight: '700', color: C.textHint, lineHeight: 30, marginTop: 2 },
    monthLabel:      { fontSize: 10, color: C.textHint, fontWeight: '500', marginTop: 1 },
    dayAccent:       { color: C.brand },
    weekendText:     { color: '#C0A0A0' },

    todayPill:       { marginTop: 5, backgroundColor: C.brand, borderRadius: R.xs, paddingHorizontal: 5, paddingVertical: 2 },
    todayPillText:   { fontSize: 8, color: C.white, fontWeight: '800', letterSpacing: 0.5 },

    notesCol:        { flex: 1, justifyContent: 'center', paddingVertical: 2 },
    emptyDay:        { color: C.border, fontSize: 18, alignSelf: 'center', marginTop: 12 },

    noteItem:        { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.sm, marginBottom: 5, paddingHorizontal: 8, paddingVertical: 6, ...S.xs },
    noteBadge:       { width: 30, height: 30, borderRadius: R.xs, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    noteBadgeText:   { fontSize: 8, fontWeight: '700', color: C.textSub, letterSpacing: 0.4 },
    noteBody:        { flex: 1 },
    noteTitle:       { fontSize: 13, color: C.text, fontWeight: '500' },
    noteSub:         { fontSize: 10, color: C.textMuted, marginTop: 1 },

    separator:       { height: 0.5, backgroundColor: C.borderLight, marginLeft: 68 },

    todayBtn:        { marginRight: 8, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.surface, borderRadius: R.sm, borderWidth: 1.5, borderColor: C.brand },
    todayBtnText:    { color: C.text, fontWeight: '600', fontSize: 13 },

    modalOverlay:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    modalSheet:      { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.surface, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, maxHeight: '80%', overflow: 'hidden' },
    modalAccent:     { height: 4 },
    modalHeader:     { flexDirection: 'row', alignItems: 'flex-start', padding: SP.md, borderBottomWidth: 0.5, borderBottomColor: C.borderLight },
    modalTitleWrap:  { flex: 1 },
    modalTitle:      { fontSize: 17, fontWeight: '700', color: C.text, lineHeight: 23 },
    modalPills:      { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6, flexWrap: 'wrap' },
    modalProject:    { fontSize: 12, color: C.textSub },
    modalCloseBtn:   { marginLeft: 12, padding: 2 },
    modalCloseText:  { fontSize: 20, color: C.textHint },
    modalBody:       { maxHeight: 340 },
    modalBodyContent:{ padding: SP.md },
    modalDescription:{ fontSize: 15, color: C.textSub, lineHeight: 23 },
    modalEmpty:      { fontSize: 14, color: C.textMuted, fontStyle: 'italic' },
    modalFooter:     { padding: SP.sm, borderTopWidth: 0.5, borderTopColor: C.borderLight },
    modalMeta:       { fontSize: 11, color: C.textHint, textAlign: 'right' },

    tagPill:         { backgroundColor: C.surfaceAlt, borderRadius: R.xs, paddingHorizontal: 6, paddingVertical: 2 },
    tagText:         { fontSize: 11, color: C.textSub, fontWeight: '600' },
  });
}
