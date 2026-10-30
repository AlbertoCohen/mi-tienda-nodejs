import { create } from 'zustand';

export type Season = 'verano' | 'invierno';

interface ThemeState {
  globalSeason: Season;
  clientSeason: Season;
  activeEvent: string;
  setClientSeason: (s: Season) => void;
  initializeTheme: (globalSeason: string, event: string) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  globalSeason: 'verano',
  clientSeason: 'verano',
  activeEvent: 'ninguno',

  setClientSeason: (s) => {
    set({ clientSeason: s });
    document.documentElement.setAttribute('data-season', s);
  },

  initializeTheme: (globalSeason, event) => {
    const s = (globalSeason === 'invierno' ? 'invierno' : 'verano') as Season;
    const current = get().clientSeason || s;
    set({ globalSeason: s, clientSeason: current, activeEvent: event || 'ninguno' });
    document.documentElement.setAttribute('data-season', current);
    document.documentElement.setAttribute('data-event', event || 'ninguno');
  }
}));
