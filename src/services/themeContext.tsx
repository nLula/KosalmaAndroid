import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { lightC, darkC, ColorsType } from '../theme';

const THEME_KEY = 'kosalma_theme_mode';

export type ThemeMode = 'light' | 'dark' | 'system';
type Ctx = { C: ColorsType; isDark: boolean; mode: ThemeMode; setMode: (m: ThemeMode) => void };

const ThemeCtx = createContext<Ctx>({ C: lightC, isDark: false, mode: 'system', setMode: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();   // 'light' | 'dark' | null, live-updates with phone theme
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    SecureStore.getItemAsync(THEME_KEY).then(v => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
    });
  }, []);

  function setMode(m: ThemeMode) {
    setModeState(m);
    SecureStore.setItemAsync(THEME_KEY, m);
  }

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';

  return (
    <ThemeCtx.Provider value={{ C: isDark ? darkC : lightC, isDark, mode, setMode }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useColors(): ColorsType { return useContext(ThemeCtx).C; }
export function useThemeCtx(): Ctx { return useContext(ThemeCtx); }
