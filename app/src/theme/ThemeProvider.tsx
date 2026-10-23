import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, type ThemeColors } from './tokens';

export type ThemeMode = 'dark' | 'light' | 'system';
export type ThemeScheme = 'dark' | 'light';

export interface Theme {
  colors: ThemeColors;
  scheme: ThemeScheme;
}

/** Context default is dark, so components work without a provider. */
const ThemeContext = createContext<Theme>({ colors: darkColors, scheme: 'dark' });

export function ThemeProvider({
  mode = 'dark',
  children,
}: {
  mode?: ThemeMode;
  children: ReactNode;
}) {
  const system = useColorScheme();
  const scheme: ThemeScheme = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode;
  const value = useMemo<Theme>(
    () => ({ scheme, colors: scheme === 'light' ? lightColors : darkColors }),
    [scheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
