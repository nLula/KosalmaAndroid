import React, { useState, useMemo, useLayoutEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, FlatList, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNotes, NoteRecord, getNoteRecords } from '../../services/notesContext';
import { CalendarStackParams } from '../CalendarScreen';
import { parseWorkSlots, generateSlotKey, formatDayTitle, WorkSlot } from './CalendarMainScreen';
import { useColors } from '../../services/themeContext';
import { S, R, SP, ColorsType } from '../../theme';

type Nav   = NativeStackNavigationProp<CalendarStackParams, 'DayView'>;
type Route = RouteProp<CalendarStackParams, 'DayView'>;

const COLORS: { value: string; label: string }[] = [
  { value: 'none',   label: 'None'   },
  { value: 'EF3340', label: 'Red'    },
  { value: '00A99D', label: 'Green'  },
  { value: 'FFF200', label: 'Yellow' },
  { value: '00B5E2', label: 'Blue'   },
];

type DayCard = { noteId: string; record: NoteRecord; slot: WorkSlot };

export default function DayViewScreen() {
  const nav   = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { dateStr } = route.params;
  const { notes, updateNote } = useNotes();

  const C = useColors();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [activeColorId,    setActiveColorId]    = useState<string | null>(null);
  const [showAssign,       setShowAssign]       = useState(false);
  const [pendingAssignId,  setPendingAssignId]  = useState<string | null>(null);
  const [pendingColor,     setPendingColor]     = useState<string>('none');
  const [savingSlot,       setSavingSlot]       = useState<string | null>(null);
  const [selectedPrefixes, setSelectedPrefixes] = useState<Set<string>>(new Set());

  useLayoutEffect(() => {
    nav.setOptions({
      title: formatDayTitle(dateStr),
      headerRight: () => (
        <TouchableOpacity style={styles.headerAssignBtn} onPress={openAssignModal} activeOpacity={0.7}>
          <Text style={styles.headerAssignText}>+ Assign task</Text>
        </TouchableOpacity>
      ),
    });
  }, [dateStr, styles]);

  const dayCards = useMemo<DayCard[]>(() => {
    const result: DayCard[] = [];
    getNoteRecords(notes).forEach(({ id, record }) => {
      parseWorkSlots(record)
        .filter(slot => slot.dateStr === dateStr)
        .forEach(slot => result.push({ noteId: id, record, slot }));
    });
    return result;
  }, [notes, dateStr]);

  const allNotes = useMemo(() =>
    getNoteRecords(notes)
      .sort((a, b) =>
        new Date(b.record.lastchanged || 0).getTime() - new Date(a.record.lastchanged || 0).getTime()
      ),
  [notes]);

  const tagPrefixes = useMemo(() => {
    const prefixes = new Set(allNotes.map(({ record }) => record.tag?.[0]?.toUpperCase()).filter(Boolean));
    return Array.from(prefixes).sort() as string[];
  }, [allNotes]);

  const filteredNotes = useMemo(() => {
    if (selectedPrefixes.size === 0) return allNotes;
    return allNotes.filter(({ record }) =>
      selectedPrefixes.has(record.tag?.[0]?.toUpperCase() ?? '')
    );
  }, [allNotes, selectedPrefixes]);

  async function handleColorChange(noteId: string, record: NoteRecord, slotKey: string, color: string) {
    setActiveColorId(null);
    setSavingSlot(slotKey);
    try {
      const current = record.workColor ?? '';
      const escaped = slotKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const replaced = current.replace(new RegExp(escaped + ':[^;]+;'), '');
      const workColor = replaced + `${slotKey}:${color};`;
      await updateNote(noteId, { ...record, workColor });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingSlot(null);
    }
  }

  async function handleRemove(noteId: string, record: NoteRecord, slotKey: string) {
    Alert.alert('Remove assignment', 'Remove this slot from the day?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          setSavingSlot(slotKey);
          try {
            const escaped   = slotKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const stripKV   = (s: string) => (s ?? '').replace(new RegExp(escaped + ':[^;]+;'), '');
            const stripItem = (s: string) => (s ?? '').replace(new RegExp(escaped + ';'), '');
            await updateNote(noteId, {
              ...record,
              work:           stripItem(record.work),
              workColor:      stripKV(record.workColor),
              createdForDate: stripKV(record.createdForDate),
              status:         stripKV(record.status),
            });
          } catch (e: any) {
            Alert.alert('Error', e.message);
          } finally {
            setSavingSlot(null);
          }
        },
      },
    ]);
  }

  async function handleAssignConfirm() {
    if (!pendingAssignId) return;
    const record  = notes[pendingAssignId] as NoteRecord;
    const slotKey = generateSlotKey(record.tag);
    setShowAssign(false);
    setPendingAssignId(null);
    setSavingSlot(slotKey);
    try {
      await updateNote(pendingAssignId, {
        ...record,
        work:           (record.work ?? '')           + `${slotKey};`,
        workColor:      (record.workColor ?? '')      + `${slotKey}:${pendingColor};`,
        createdForDate: (record.createdForDate ?? '') + `${slotKey}:${dateStr};`,
        status:         (record.status ?? '')         + `${slotKey}:unchecked;`,
      });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingSlot(null);
    }
  }

  function openAssignModal() {
    setPendingAssignId(null);
    setPendingColor('none');
    setSelectedPrefixes(new Set());
    setShowAssign(true);
  }

  function togglePrefix(p: string) {
    setSelectedPrefixes(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
    setPendingAssignId(null);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {dayCards.length === 0 && (
          <Text style={styles.empty}>No notes assigned to this day.{'\n'}Tap below to add one.</Text>
        )}

        {dayCards.map(({ noteId, record, slot }) => {
          const cardKey  = slot.slotKey;
          const bg       = slotColor(slot.color, C.border);
          const isLight  = slot.color === 'FFF200';
          const tagLabel = (record.tag || '—').slice(0, 4).toUpperCase();
          const sub      = [record.tag, record.project].filter(Boolean).join(' · ');
          return (
            <View key={cardKey} style={styles.card}>
              <View style={styles.cardTop}>
                <TouchableOpacity
                  style={[styles.badge, { backgroundColor: bg, borderColor: bg }, activeColorId === cardKey && styles.badgeActive]}
                  onPress={() => setActiveColorId(activeColorId === cardKey ? null : cardKey)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.badgeText, { color: isLight ? C.text : C.white }]}>{tagLabel}</Text>
                </TouchableOpacity>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardHeader} numberOfLines={1}>
                    {record.header?.replace(/^#+\s*/, '') || '(no title)'}
                  </Text>
                  {sub ? <Text style={styles.cardSub} numberOfLines={1}>{sub}</Text> : null}
                </View>
                {savingSlot === cardKey
                  ? <ActivityIndicator size="small" color={C.brand} style={{ marginLeft: 8 }} />
                  : (
                    <TouchableOpacity
                      onPress={() => handleRemove(noteId, record, slot.slotKey)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={{ marginLeft: 8, padding: 4 }}
                    >
                      <Text style={styles.removeX}>✕</Text>
                    </TouchableOpacity>
                  )
                }
              </View>

              {activeColorId === cardKey && (
                <View style={styles.colorPickerRow}>
                  <Text style={styles.colorPickerLabel}>Color:</Text>
                  {COLORS.map(({ value, label }) => (
                    <TouchableOpacity
                      key={value}
                      onPress={() => handleColorChange(noteId, record, slot.slotKey, value)}
                      style={[styles.colorChip, slot.color === value && styles.colorChipSelected]}
                    >
                      <View style={[styles.colorChipSwatch, { backgroundColor: slotColor(value, C.border) }]} />
                      <Text style={styles.colorChipLabel}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal
        visible={showAssign}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAssign(false)}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowAssign(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Assign note</Text>
            <TouchableOpacity onPress={() => setShowAssign(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.sheetClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {tagPrefixes.length > 1 && (
            <View style={styles.prefixRow}>
              <Text style={styles.prefixLabel}>Filter by tag:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.prefixChips}>
                {tagPrefixes.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.prefixChip, selectedPrefixes.has(p) && styles.prefixChipActive]}
                    onPress={() => togglePrefix(p)}
                  >
                    <Text style={[styles.prefixChipText, selectedPrefixes.has(p) && styles.prefixChipTextActive]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <FlatList
            data={filteredNotes}
            keyExtractor={({ id }) => id}
            style={{ maxHeight: 420 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: { id, record } }) => {
              const isPending = pendingAssignId === id;
              const isSaving  = savingSlot !== null && pendingAssignId === id;
              return (
                <View>
                  <TouchableOpacity
                    style={[styles.sheetItem, isPending && styles.sheetItemPending]}
                    onPress={() => {
                      if (pendingAssignId === id) { setPendingAssignId(null); }
                      else { setPendingAssignId(id); setPendingColor('none'); }
                    }}
                    disabled={isSaving}
                  >
                    <View style={styles.sheetItemBody}>
                      <Text style={styles.sheetItemHeader} numberOfLines={1}>
                        {record.header?.replace(/^#+\s*/, '') || '(no title)'}
                      </Text>
                      <View style={styles.pills}>
                        <View style={styles.tagPill}><Text style={styles.tagText}>{record.tag}</Text></View>
                      </View>
                    </View>
                    {isSaving
                      ? <ActivityIndicator size="small" color={C.brand} />
                      : <Text style={[styles.expandIcon, isPending && { color: C.brand }]}>
                          {isPending ? '▲' : '▼'}
                        </Text>
                    }
                  </TouchableOpacity>

                  {isPending && (
                    <View style={styles.assignPicker}>
                      <Text style={styles.assignPickerLabel}>Choose color:</Text>
                      <View style={styles.assignColorRow}>
                        {COLORS.map(({ value, label }) => (
                          <TouchableOpacity
                            key={value}
                            onPress={() => setPendingColor(value)}
                            style={[styles.colorChip, pendingColor === value && styles.colorChipSelected]}
                          >
                            <View style={[styles.colorChipSwatch, { backgroundColor: slotColor(value, C.border) }]} />
                            <Text style={styles.colorChipLabel}>{label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TouchableOpacity style={styles.confirmBtn} onPress={handleAssignConfirm}>
                        <Text style={styles.confirmBtnText}>Assign to this day</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={<Text style={styles.sheetEmpty}>No notes yet</Text>}
          />
        </View>
      </Modal>
    </View>
  );
}

function slotColor(color: string, border: string): string {
  if (!color || color === 'none' || color === 'FFFFFF' || color === 'transparent') return border;
  return `#${color}`;
}

function makeStyles(C: ColorsType) {
  return StyleSheet.create({
    container:         { flex: 1, backgroundColor: C.bg },
    content:           { padding: SP.md, paddingBottom: SP.lg },
    empty:             { textAlign: 'center', marginTop: 60, color: C.textMuted, fontSize: 14, lineHeight: 22 },

    card:              { backgroundColor: C.surface, borderRadius: R.md, marginBottom: SP.sm, ...S.sm },
    cardTop:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.md, paddingVertical: SP.sm + 2 },
    badge:             { width: 36, height: 36, borderRadius: R.xs, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    badgeActive:       { opacity: 0.75 },
    badgeText:         { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
    cardInfo:          { flex: 1 },
    cardHeader:        { fontSize: 14, color: C.text, fontWeight: '500' },
    cardSub:           { fontSize: 11, color: C.textMuted, marginTop: 2 },
    removeX:           { fontSize: 15, color: C.textHint },

    colorPickerRow:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: SP.sm + 4, paddingBottom: SP.sm + 4, gap: 6, backgroundColor: C.surfaceAlt, borderTopWidth: 0.5, borderTopColor: C.borderLight },
    colorPickerLabel:  { fontSize: 11, color: C.textMuted, fontWeight: '600', marginRight: 2 },
    colorChip:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: R.pill, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface },
    colorChipSelected: { borderColor: C.brand, backgroundColor: C.brandLight },
    colorChipSwatch:   { width: 12, height: 12, borderRadius: 6, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.1)' },
    colorChipLabel:    { fontSize: 11, color: C.textSub },

    headerAssignBtn:   { marginRight: 0, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.surface, borderRadius: R.sm, borderWidth: 1.5, borderColor: C.brand },
    headerAssignText:  { color: C.text, fontWeight: '600', fontSize: 13 },

    overlay:           { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
    sheet:             { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.surface, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, paddingBottom: 32 },
    sheetHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.md, paddingVertical: SP.sm + 2, borderBottomWidth: 0.5, borderBottomColor: C.borderLight },
    sheetTitle:        { fontSize: 15, fontWeight: '600', color: C.text },
    sheetClose:        { fontSize: 16, color: C.textMuted, padding: 2 },

    prefixRow:         { paddingHorizontal: SP.md, paddingVertical: SP.sm, borderBottomWidth: 0.5, borderBottomColor: C.borderLight },
    prefixLabel:       { fontSize: 10, fontWeight: '700', color: C.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
    prefixChips:       { gap: 6 },
    prefixChip:        { paddingHorizontal: 11, paddingVertical: 4, borderRadius: R.pill, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
    prefixChipActive:  { borderColor: C.brand },
    prefixChipText:    { fontSize: 12, fontWeight: '500', color: C.textMuted },
    prefixChipTextActive: { color: C.brand, fontWeight: '600' },

    sheetItem:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.md, paddingVertical: SP.sm + 2, borderBottomWidth: 0.5, borderBottomColor: C.borderLight },
    sheetItemPending:  { backgroundColor: C.brandPale },
    sheetItemBody:     { flex: 1 },
    sheetItemHeader:   { fontSize: 14, color: C.text },
    expandIcon:        { fontSize: 11, color: C.textHint, marginLeft: 12 },
    sheetEmpty:        { padding: 28, textAlign: 'center', color: C.textMuted, fontSize: 13 },

    pills:             { flexDirection: 'row', marginTop: 4, gap: 6 },
    tagPill:           { backgroundColor: C.surfaceAlt, borderRadius: R.xs, paddingHorizontal: 6, paddingVertical: 2 },
    tagText:           { fontSize: 10, color: C.textSub, fontWeight: '600' },

    assignPicker:      { backgroundColor: C.bg, borderBottomWidth: 0.5, borderBottomColor: C.borderLight, padding: SP.sm + 4 },
    assignPickerLabel: { fontSize: 10, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
    assignColorRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SP.sm + 4 },
    confirmBtn:        { borderWidth: 1.5, borderColor: C.brand, borderRadius: R.sm, padding: 10, alignItems: 'center', backgroundColor: C.surface },
    confirmBtnText:    { color: C.text, fontWeight: '600', fontSize: 13 },
  });
}
