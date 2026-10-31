export type ThemeName = 'midnight' | 'paper' | 'forest';
export type KeyProvider = 'openai' | 'anthropic' | 'google' | 'openrouter';

export interface UserSettings {
  displayName: string;
  theme: ThemeName;
  keys: Record<KeyProvider, string>;
  selectedProvider: KeyProvider;
  selectedModel: string;
}

const STORAGE_KEY = 'tarq.user-settings.v1';
const SETTINGS_EVENT = 'tarq:user-settings-updated';

const defaults: UserSettings = {
  displayName: 'User',
  theme: 'midnight',
  keys: { openai: '', anthropic: '', google: '', openrouter: '' },
  selectedProvider: 'google',
  selectedModel: 'gemini-2.5-flash',
};

export function readUserSettings(): UserSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaults;
    const parsed = JSON.parse(stored) as Partial<UserSettings>;
    return {
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : defaults.displayName,
      theme: parsed.theme === 'paper' || parsed.theme === 'forest' ? parsed.theme : defaults.theme,
      selectedProvider: parsed.selectedProvider === 'openai' || parsed.selectedProvider === 'anthropic' || parsed.selectedProvider === 'google' || parsed.selectedProvider === 'openrouter'
        ? parsed.selectedProvider
        : defaults.selectedProvider,
      selectedModel: typeof parsed.selectedModel === 'string' ? parsed.selectedModel : defaults.selectedModel,
      keys: {
        openai: typeof parsed.keys?.openai === 'string' ? parsed.keys.openai : '',
        anthropic: typeof parsed.keys?.anthropic === 'string' ? parsed.keys.anthropic : '',
        google: typeof parsed.keys?.google === 'string' ? parsed.keys.google : '',
        openrouter: typeof parsed.keys?.openrouter === 'string' ? parsed.keys.openrouter : '',
      },
    };
  } catch {
    return defaults;
  }
}

export function writeUserSettings(settings: UserSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

export function subscribeToUserSettings(listener: () => void): () => void {
  window.addEventListener(SETTINGS_EVENT, listener);
  return () => window.removeEventListener(SETTINGS_EVENT, listener);
}

export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
}