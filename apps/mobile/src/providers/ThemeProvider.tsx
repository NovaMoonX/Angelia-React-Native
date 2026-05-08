import React, { createContext } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme, type Theme } from '@/constants/theme';

interface ThemeContextType {
  resolvedTheme: 'light' | 'dark';
  theme: Theme;
}

export const ThemeContext = createContext<ThemeContextType>({
  resolvedTheme: 'light',
  theme: lightTheme,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const resolvedTheme: 'light' | 'dark' = systemScheme === 'dark' ? 'dark' : 'light';
  const theme = resolvedTheme === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ resolvedTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
}
