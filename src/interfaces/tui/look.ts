import { createContext, useContext } from 'react';
import { ICONS, type Icons, THEMES, type Theme } from './theme.ts';

export interface Look {
  theme: Theme;
  icons: Icons;
}

export const LookContext = createContext<Look>({ theme: THEMES[0], icons: ICONS.unicode });

export function useLook(): Look {
  return useContext(LookContext);
}
