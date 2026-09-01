import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Easing, RefreshControl,
} from 'react-native';
import { loadConfig } from '../services/storage';
import {
  enqueueSwitch, getSwitchCommand, fetchSwitchState, SwitchState,
} from '../services/switchRelay';
import { useColors } from '../services/themeContext';
import { S, R, SP, ColorsType } from '../theme';

// Mirrors SWITCH_DEFAULTS in the Kosalma monitor's app.py. The phone never
// talks to a board, so it needs no hosts or API keys — only what to show and
// how long to hold the control after a press.
const SWITCHES = [
  { id: 'cobalm', label: 'Cobalm OFF', type: 'pulse' as const, cooldown: 5 },
  { id: 'valve1', label: 'Valve 1',    type: 'valve' as const, cooldown: 30 },
  { id: 'valve2', label: 'Valve 2',    type: 'valve' as const, cooldown: 30 },
];

const RED = '#dc2626';
const GREEN = '#00A651';
const AMBER = '#f59e0b';

type Busy = { until: number; label: string } | null;

export default function SwitchesScreen() {
  const C = useColors();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [state, setState] = useState<SwitchState>({});
  const [status, setStatus] = useState<Record<string, string>>({});
  const [statusKind, setStatusKind] = useState<Record<string, 'ok' | 'error' | 'info'>>({});
  const [busy, setBusy] = useState<Record<string, Busy>>({});
  const [moving, setMoving] = useState<Record<string, string>>({});   // id -> action
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const refreshState = useCallback(async () => {
    try {
      const config = await loadConfig();
      const next = await fetchSwitchState(config);
      if (mounted.current) {
        setState(next);
        setLoadError(null);
      }
    } catch (e: any) {
      if (mounted.current) setLoadError(e.message);
    }
  }, []);

  useEffect(() => { refreshState(); }, [refreshState]);

  // Pick up moves made from another app, and drive the cooldown countdowns
  useEffect(() => {
    const poll = setInterval(refreshState, 10000);
    const clock = setInterval(() => setTick(t => t + 1), 1000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [refreshState]);

  function remaining(id: string): number {
    const b = busy[id];
    if (!b) return 0;
    return Math.max(0, Math.ceil((b.until - Date.now()) / 1000));
  }

  function positionOf(id: string): string {
    return state[id]?.position ?? 'unknown';
  }

  async function press(sw: typeof SWITCHES[number]) {
    if (remaining(sw.id) > 0) return;

    // One handle, two positions: whichever way it is now, send it the other
    // way. From open OR unknown we close — the safe direction for a water
    // valve, and the one that re-establishes a known position.
    const action = sw.type === 'valve'
      ? (positionOf(sw.id) === 'closed' ? 'open' : 'close')
      : 'pulse';

    setBusy(b => ({ ...b, [sw.id]: { until: Date.now() + sw.cooldown * 1000, label: sw.label } }));
    if (sw.type === 'valve') setMoving(m => ({ ...m, [sw.id]: action }));
    setStatus(s => ({ ...s, [sw.id]: 'Requesting…' }));
    setStatusKind(k => ({ ...k, [sw.id]: 'info' }));

    try {
      const config = await loadConfig();
      const commandId = await enqueueSwitch(config, sw.id, sw.label, action);
      setStatus(s => ({ ...s, [sw.id]: 'Sent to workshop app' }));
      watchCommand(sw.id, commandId, sw.label);
    } catch (e: any) {
      setStatus(s => ({ ...s, [sw.id]: e.message || 'Could not queue the request' }));
      setStatusKind(k => ({ ...k, [sw.id]: 'error' }));
      setBusy(b => ({ ...b, [sw.id]: null }));
      setMoving(m => { const n = { ...m }; delete n[sw.id]; return n; });
    }
  }

  // The workshop PC polls the repo every ~10s, so give it a minute to reply.
  function watchCommand(id: string, commandId: string, label: string) {
    let waited = 0;
    const poll = setInterval(async () => {
      waited += 4;
      if (!mounted.current || waited > 80) {
        clearInterval(poll);
        if (mounted.current) {
          setStatus(s => ({ ...s, [id]: 'No reply from the workshop app' }));
          setStatusKind(k => ({ ...k, [id]: 'error' }));
          setMoving(m => { const n = { ...m }; delete n[id]; return n; });
        }
        return;
      }
      try {
        const config = await loadConfig();
        const command = await getSwitchCommand(config, commandId);
        if (!command || command.status === 'pending') return;

        clearInterval(poll);
        if (!mounted.current) return;
        setMoving(m => { const n = { ...m }; delete n[id]; return n; });
        setStatus(s => ({ ...s, [id]: command.message || command.status }));
        setStatusKind(k => ({ ...k, [id]: command.status === 'done' ? 'ok' : 'error' }));
        refreshState();
      } catch {
        // a dropped poll is not worth reporting; the next one will do
      }
    }, 4000);
  }

  async function onRefresh() {
    setRefreshing(true);
    await refreshState();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
                        colors={[C.brand]} tintColor={C.brand} />
      }
    >
      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          Presses are sent through Git and performed by the workshop app —
          expect a short delay.
        </Text>
      </View>

      {loadError && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>⚠ {loadError}</Text>
        </View>
      )}

      {SWITCHES.map(sw => {
        const left = remaining(sw.id);
        const disabled = left > 0;
        const kind = statusKind[sw.id] ?? 'info';
        const message = disabled ? `Ready in ${left}s` : (status[sw.id] ?? '');

        return (
          <View key={sw.id} style={styles.card}>
            {sw.type === 'valve' ? (
              <ValveKnob
                position={moving[sw.id] ? 'moving' : positionOf(sw.id)}
                disabled={disabled}
                onPress={() => press(sw)}
                C={C}
              />
            ) : (
              <TouchableOpacity
                style={[styles.pulseBtn, disabled && styles.pulseBtnDisabled]}
                onPress={() => press(sw)}
                disabled={disabled}
                activeOpacity={0.7}
              >
                <Text style={[styles.pulseLabel, disabled && styles.pulseLabelDisabled]}>
                  {sw.label}
                </Text>
              </TouchableOpacity>
            )}

            <Text style={styles.cardTitle}>{sw.label}</Text>

            {sw.type === 'valve' && (
              <Text style={[
                styles.position,
                positionOf(sw.id) === 'open' && { color: GREEN },
                positionOf(sw.id) === 'closed' && { color: RED },
                moving[sw.id] ? { color: AMBER } : null,
              ]}>
                {moving[sw.id]
                  ? (moving[sw.id] === 'open' ? 'OPENING' : 'CLOSING')
                  : positionOf(sw.id).toUpperCase()}
              </Text>
            )}

            {!!message && (
              <Text style={[
                styles.status,
                kind === 'ok' && !disabled && { color: GREEN },
                kind === 'error' && !disabled && { color: RED },
              ]} numberOfLines={3}>
                {message}
              </Text>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── the valve handle ────────────────────────────────────────────────────────
// One control with two positions. The lever lies across the body when the valve
// is shut and makes a quarter turn when it opens, like the real ball valve.

function ValveKnob({
  position, disabled, onPress, C,
}: {
  position: string;
  disabled: boolean;
  onPress: () => void;
  C: ColorsType;
}) {
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const target = position === 'open' ? 1 : position === 'moving' ? 0.5 : 0;
  const anim = useRef(new Animated.Value(target)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: target,
      duration: 1100,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [target, anim]);

  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const color = position === 'open' ? GREEN
              : position === 'closed' ? RED
              : position === 'moving' ? AMBER
              : C.textMuted;

  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.7}
                      style={[styles.knobHit, disabled && { opacity: 0.5 }]}>
      <View style={[styles.knobBody, { borderColor: color }]} />
      <Animated.View style={[styles.knobHandle, { backgroundColor: color, transform: [{ rotate }] }]} />
      <View style={[styles.knobPivot, { borderColor: color }]} />
    </TouchableOpacity>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const KNOB = 96;

function makeStyles(C: ColorsType) {
  return StyleSheet.create({
    container:  { flex: 1, backgroundColor: C.bg },
    content:    { padding: SP.md, paddingBottom: SP.xl },

    notice:     { backgroundColor: '#fffbeb', borderWidth: 0.5, borderColor: '#fcd34d',
                  borderRadius: R.md, padding: SP.md, marginBottom: SP.md },
    noticeText: { fontSize: 12, color: '#92400e', lineHeight: 17 },

    errorCard:  { backgroundColor: '#FFF5F5', borderRadius: R.sm, padding: SP.md, marginBottom: SP.sm },
    errorText:  { color: C.error, fontSize: 13, fontWeight: '500' },

    card:       { backgroundColor: C.surface, borderRadius: R.md, marginBottom: SP.md,
                  paddingVertical: SP.lg, alignItems: 'center', ...S.sm },
    cardTitle:  { fontSize: 15, fontWeight: '600', color: C.text, marginTop: 10 },
    position:   { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 3, color: C.textMuted },
    status:     { fontSize: 11, color: C.textMuted, marginTop: 6, textAlign: 'center',
                  paddingHorizontal: SP.md, lineHeight: 15 },

    pulseBtn:   { width: 190, height: 88, borderWidth: 2, borderColor: RED, borderRadius: R.md,
                  alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface },
    pulseBtnDisabled: { borderColor: C.border },
    pulseLabel: { fontSize: 16, fontWeight: '600', color: C.text },
    pulseLabelDisabled: { color: C.textMuted },

    knobHit:    { width: KNOB, height: KNOB, alignItems: 'center', justifyContent: 'center' },
    knobBody:   { position: 'absolute', left: 12, top: 12, right: 12, bottom: 12,
                  borderRadius: (KNOB - 24) / 2, borderWidth: 2, backgroundColor: C.surfaceAlt },
    knobHandle: { position: 'absolute', left: 8, right: 8, height: 10, borderRadius: 5 },
    knobPivot:  { position: 'absolute', width: 16, height: 16, borderRadius: 8,
                  borderWidth: 2, backgroundColor: C.surface },
  });
}
