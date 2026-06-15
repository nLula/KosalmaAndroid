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
import { C, S, R, SP } from '../../theme';

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

  const [activeColorId,    setActiveColorId]    = useState<string | null>(null);
  const [showAssign,       setShowAssign]       = useState(false);
  const [pendingAssignId,  setPendingAssignId]  = useState<string | null>(null);
  const [pendingColor,     setPendingColor]     = useState<string>('none');
  const [savingSlot,       setSavingSlot]       = useState<string | null>(null);
  const [selectedPrefixes, setSelectedPrefixes] = useState<Set<string>>(new Set());

  useLayoutEffect(() => {
    nav.setOptions({ title: formatDayTitle(dateStr) });
  }, [dateStr]);

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
          const cardKey = slot.slotKey;
          const dotBg   = slotColor(slot.color);
          return (
            <View key={cardKey} style={styles.card}>
              <View style={styles.cardTop}>
                <TouchableOpacity
                  style={[styles.colorDot, { backgroundColor: dotBg }, activeColorId === cardKey && styles.colorDotActive]}
                  onPress={() => setActiveColorId(activeColorId === cardKey ? null : cardKey)}
                />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardHeader} numberOfLines={2}>
                    {record.header?.replace(/^#+\s*/, '') || '(no title)'}
                  </Text>
                  <View style={styles.pills}>
                    <View style={styles.tagPill}><Text style={styles.tagText}>{record.tag}</Text></View>
                    {record.project ? <Text style={styles.project}>{record.project}</Text> : null}
                  </View>
                </View>
                {savingSlot === cardKey
                  ? <ActivityIndicator size="small" color={C.brand} style={{ marginLeft: 8 }} />
                  : (
                    <TouchableOpacity
                      onPress={() => handleRemove(noteId, record, slot.slotKey)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={{ marginLeft: 8 }}
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
                      <View style={[styles.colorChipSwatch, { backgroundColor: slotColor(value) }]} />
                      <Text style={styles.colorChipLabel}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.assignBtn} onPress={openAssignModal}>
          <Text style={styles.assignBtnText}>+ Assign note to this day</Text>
        </TouchableOpacity>
      </View>

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
                            <View style={[styles.colorChipSwatch, { backgroundColor: slotColor(value) }]} />
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

function slotColor(color: string): string {
  if (!color || color === 'none' || color === 'FFFFFF' || color === 'transparent') return C.border;
  return `#${color}`;
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: C.bg },
  content:           { padding: SP.md, paddingBottom: SP.lg },
  empty:             { textAlign: 'center', marginTop: 60, color: C.textMuted, fontSize: 14, lineHeight: 22 },

  card:              { backgroundColor: C.surface, borderRadius: R.md, marginBottom: SP.sm, overflow: 'hidden', ...S.sm },
  cardTop:           { flexDirection: 'row', alignItems: 'center', padding: SP.sm + 4 },
  colorDot:          { width: 22, height: 22, borderRadius: 11, marginRight: 12, borderWidth: 2, borderColor: 'transparent' },
  colorDotActive:    { borderColor: C.brand },
  cardInfo:          { flex: 1 },
  cardHeader:        { fontSize: 15, color: C.text, fontWeight: '600' },
  pills:             { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 6, flexWrap: 'wrap' },
  tagPill:           { backgroundColor: C.brandLight, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tagText:           { fontSize: 11, color: C.brand, fontWeight: '700' },
  project:           { fontSize: 11, color: C.textMuted },
  removeX:           { fontSize: 16, color: C.textHint, padding: 2 },

  colorPickerRow:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: SP.sm + 4, paddingBottom: SP.sm + 4, gap: 6, backgroundColor: C.surfaceAlt, borderTopWidth: 0.5, borderTopColor: C.borderLight },
  colorPickerLabel:  { fontSize: 11, color: C.textMuted, fontWeight: '600', marginRight: 2 },
  colorChip:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: R.pill, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface },
  colorChipSelected: { borderColor: C.brand, backgroundColor: C.brandLight },
  colorChipSwatch:   { width: 12, height: 12, borderRadius: 6, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.1)' },
  colorChipLabel:    { fontSize: 11, color: C.textSub },

  footer:            { borderTopWidth: 0.5, borderTopColor: C.borderLight, padding: SP.sm, backgroundColor: C.surface },
  assignBtn:         { backgroundColor: C.brand, borderRadius: R.md, padding: 14, alignItems: 'center' },
  assignBtnText:     { color: C.white, fontWeight: '700', fontSize: 15 },

  overlay:           { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:             { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.surface, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, paddingBottom: 32 },
  sheetHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SP.md, borderBottomWidth: 0.5, borderBottomColor: C.borderLight },
  sheetTitle:        { fontSize: 16, fontWeight: '700', color: C.text },
  sheetClose:        { fontSize: 18, color: C.textHint },

  prefixRow:         { paddingHorizontal: SP.md, paddingVertical: SP.sm, borderBottomWidth: 0.5, borderBottomColor: C.borderLight, backgroundColor: C.surfaceAlt },
  prefixLabel:       { fontSize: 11, fontWeight: '700', color: C.textMuted, marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.4 },
  prefixChips:       { gap: 6 },
  prefixChip:        { paddingHorizontal: 13, paddingVertical: 6, borderRadius: R.pill, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface },
  prefixChipActive:  { borderColor: C.brand, backgroundColor: C.brandLight },
  prefixChipText:    { fontSize: 13, fontWeight: '600', color: C.textMuted },
  prefixChipTextActive: { color: C.brand },

  sheetItem:         { flexDirection: 'row', alignItems: 'center', padding: SP.md, borderBottomWidth: 0.5, borderBottomColor: C.borderLight },
  sheetItemPending:  { backgroundColor: C.brandPale },
  sheetItemBody:     { flex: 1 },
  sheetItemHeader:   { fontSize: 15, color: C.text },
  expandIcon:        { fontSize: 12, color: C.textHint, marginLeft: 12 },
  sheetEmpty:        { padding: 28, textAlign: 'center', color: C.textMuted, fontSize: 13 },

  assignPicker:      { backgroundColor: C.brandPale, borderBottomWidth: 0.5, borderBottomColor: C.borderLight, padding: SP.sm + 4 },
  assignPickerLabel: { fontSize: 11, color: C.textMuted, fontWeight: '600', marginBottom: 8 },
  assignColorRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SP.sm + 4 },
  confirmBtn:        { backgroundColor: C.brand, borderRadius: R.sm, padding: 12, alignItems: 'center' },
  confirmBtnText:    { color: C.white, fontWeight: '700', fontSize: 14 },
});
