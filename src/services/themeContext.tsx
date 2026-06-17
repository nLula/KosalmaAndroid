import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { lightC, darkC, ColorsType } from '../theme';

const THEME_KEY = 'kosalma_theme_mode';

type ThemeMode = 'light' | 'dark';
type Ctx = { C: ColorsType; isDark: boolean; setMode: (m: ThemeMode) => void };

const ThemeCtx = createContext<Ctx>({ C: lightC, isDark: false, setMode: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(THEME_KEY).then(v => {
      if (v === 'dark') setIsDark(true);
    });
  }, []);

  function setMode(mode: ThemeMode) {
    setIsDark(mode === 'dark');
    SecureStore.setItemAsync(THEME_KEY, mode);
  }

  return (
    <ThemeCtx.Provider value={{ C: isDark ? darkC : lightC, isDark, setMode }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useColors(): ColorsType { return useContext(ThemeCtx).C; }
export function useThemeCtx(): Ctx { return useContext(ThemeCtx); }
