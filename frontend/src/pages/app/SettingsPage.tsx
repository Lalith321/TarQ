import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Check, Eye, EyeOff, KeyRound, Palette, Save, UserRound } from 'lucide-react';
import { applyTheme, readUserSettings, writeUserSettings, type KeyProvider, type ThemeName, type UserSettings } from '@/services/userSettings';

const providers: { id: KeyProvider; name: string; detail: string }[] = [
  { id: 'anthropic', name: 'Anthropic', detail: 'Claude models' },
  { id: 'openai', name: 'OpenAI', detail: 'GPT models' },
  { id: 'google', name: 'Google AI', detail: 'Gemini models' },
  { id: 'openrouter', name: 'OpenRouter', detail: 'Multiple model providers' },
];

const modelCatalog: Record<KeyProvider, { id: string; name: string }[]> = {
  anthropic: [
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
  ],
  openai: [
    { id: 'gpt-4.1', name: 'GPT-4.1' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini' },
    { id: 'o3-mini', name: 'o3-mini' },
  ],
  google: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  ],
  openrouter: [
    { id: 'anthropic/claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
    { id: 'openai/gpt-4.1', name: 'GPT-4.1' },
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  ],
};

const themes: { id: ThemeName; name: string; detail: string; colors: string[] }[] = [
  { id: 'midnight', name: 'Midnight', detail: 'The current dark workspace', colors: ['#07080f', '#3b82f6', '#06b6d4'] },
  { id: 'paper', name: 'Paper', detail: 'A bright, low-glare canvas', colors: ['#f4f3ee', '#16735d', '#cf5b36'] },
  { id: 'forest', name: 'Forest', detail: 'Deep green with warm accents', colors: ['#101a17', '#55b685', '#e2a45c'] },
];

const tabs = [
  { id: 'keys', label: 'Keys', path: '/app/settings/keys', icon: KeyRound },
  { id: 'personalization', label: 'Personalization', path: '/app/settings/personalization', icon: Palette },
  { id: 'profile', label: 'Profile', path: '/app/settings/profile', icon: UserRound },
];

export default function SettingsPage() {
  const location = useLocation();
  const [settings, setSettings] = useState<UserSettings>(() => readUserSettings());
  const [saved, setSaved] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Partial<Record<KeyProvider, boolean>>>({});
  const activeTab = location.pathname.split('/').pop() ?? 'keys';
  const configuredProviders = providers.filter(({ id }) => Boolean(settings.keys[id]));
  const selectedModels = modelCatalog[settings.selectedProvider];

  function selectProvider(provider: KeyProvider) {
    const model = modelCatalog[provider][0].id;
    setSettings((current) => ({ ...current, selectedProvider: provider, selectedModel: model }));
    setSaved(false);
  }

  function saveModelPreference() {
    updateSettings(settings);
  }

  function updateSettings(next: UserSettings) {
    setSettings(next);
    writeUserSettings(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  function updateKey(provider: KeyProvider, value: string) {
    setSettings((current) => ({ ...current, keys: { ...current.keys, [provider]: value } }));
    setSaved(false);
  }

  function saveKeys() {
    updateSettings(settings);
  }

  function clearKey(provider: KeyProvider) {
    updateSettings({ ...settings, keys: { ...settings.keys, [provider]: '' } });
  }

  function selectTheme(theme: ThemeName) {
    applyTheme(theme);
    updateSettings({ ...settings, theme });
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6 border-b pb-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>Local workspace</p>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>User settings</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Manage provider credentials and make TarQ feel like yours.</p>
      </header>

      <nav aria-label="User settings" className="mb-6 flex gap-1 overflow-x-auto border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {tabs.map(({ id, label, path, icon: Icon }) => (
          <NavLink
            key={id}
            to={path}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors"
            style={({ isActive }) => ({
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              borderColor: isActive ? 'var(--accent)' : 'transparent',
            })}
          >
            <Icon size={16} aria-hidden="true" />{label}
          </NavLink>
        ))}
      </nav>

      {activeTab === 'keys' && (
        <section aria-labelledby="keys-heading" className="max-w-3xl">
          <div className="mb-5">
            <h2 id="keys-heading" className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Provider keys</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Keep credentials available on this machine for your local setup.</p>
          </div>

          <div className="mb-5 border-l-2 px-4 py-3 text-sm" style={{ background: 'var(--bg-raised)', borderColor: 'var(--status-warn)', color: 'var(--text-secondary)' }}>
            <strong className="font-semibold" style={{ color: 'var(--text-primary)' }}>Stored in this browser profile.</strong>{' '}
            Saved keys are sent to the backend only for live model requests and are not stored by TarQ. They remain unencrypted in browser storage, so use this only on a trusted profile and use HTTPS when connecting to a remote backend.
          </div>

          <div className="mb-6 border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', borderRadius: '6px' }}>
            <div className="mb-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Default model</h3>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Choose the provider and model used for dashboard agent requests in this browser profile.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                Provider
                <select
                  className="mt-1 w-full px-3 text-sm"
                  onChange={(event) => selectProvider(event.target.value as KeyProvider)}
                  value={settings.selectedProvider}
                >
                  {!configuredProviders.some(({ id }) => id === settings.selectedProvider) && (
                    <option value={settings.selectedProvider}>
                      {providers.find(({ id }) => id === settings.selectedProvider)?.name ?? 'Provider'} (add a key below)
                    </option>
                  )}
                  {configuredProviders.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                </select>
              </label>
              <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                Model
                <select
                  className="mt-1 w-full px-3 text-sm"
                  onChange={(event) => setSettings((current) => ({ ...current, selectedModel: event.target.value }))}
                  value={settings.selectedModel}
                >
                  {selectedModels.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                </select>
              </label>
            </div>
            {configuredProviders.length === 0 && (
              <p className="mt-3 text-xs" style={{ color: 'var(--status-warn)' }}>Add and save a provider key below to select it as the default.</p>
            )}
            <div className="mt-4 flex items-center gap-3">
              <button type="button" className="btn outline" onClick={saveModelPreference}><Save size={15} />Save model preference</button>
              {saved && <span role="status" className="inline-flex items-center gap-1 text-sm" style={{ color: 'var(--status-ok)' }}><Check size={15} />Saved locally</span>}
            </div>
          </div>

          <div className="space-y-3">
            {providers.map((provider) => {
              const configured = Boolean(settings.keys[provider.id]);
              const visible = Boolean(visibleKeys[provider.id]);
              return (
                <div key={provider.id} className="border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', borderRadius: '6px' }}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{provider.name}</h3>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{provider.detail}</p>
                    </div>
                    <span className="text-xs" style={{ color: configured ? 'var(--status-ok)' : 'var(--text-muted)' }}>
                      {configured ? 'Configured locally' : 'Not configured'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative min-w-0 flex-1">
                      <input
                        aria-label={`${provider.name} API key`}
                        autoComplete="off"
                        className="w-full px-3 pr-10 text-sm"
                        onChange={(event) => updateKey(provider.id, event.target.value)}
                        placeholder={`Enter ${provider.name} API key`}
                        spellCheck={false}
                        type={visible ? 'text' : 'password'}
                        value={settings.keys[provider.id]}
                      />
                      <button
                        type="button"
                        aria-label={visible ? `Hide ${provider.name} key` : `Show ${provider.name} key`}
                        className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded hover:bg-white/[0.06]"
                        onClick={() => setVisibleKeys((current) => ({ ...current, [provider.id]: !current[provider.id] }))}
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {configured && (
                      <button type="button" className="btn outline" onClick={() => clearKey(provider.id)}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button type="button" className="btn" onClick={saveKeys}><Save size={15} />Save keys</button>
            {saved && <span role="status" className="inline-flex items-center gap-1 text-sm" style={{ color: 'var(--status-ok)' }}><Check size={15} />Saved locally</span>}
          </div>
        </section>
      )}

      {activeTab === 'personalization' && (
        <section aria-labelledby="personalization-heading" className="max-w-3xl">
          <h2 id="personalization-heading" className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Choose a theme</h2>
          <p className="mb-5 mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Applied immediately and remembered on this machine.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {themes.map((theme) => {
              const selected = settings.theme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectTheme(theme.id)}
                  className="border p-4 text-left transition-colors"
                  style={{ background: 'var(--bg-surface)', borderColor: selected ? 'var(--accent)' : 'var(--border-subtle)', borderRadius: '6px' }}
                >
                  <span className="mb-3 flex h-12 items-end gap-1 border p-2" style={{ background: theme.colors[0], borderColor: 'var(--border-subtle)' }}>
                    {theme.colors.slice(1).map((color) => <span key={color} className="h-5 w-5 rounded-full" style={{ background: color }} />)}
                  </span>
                  <span className="block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{theme.name}</span>
                  <span className="mt-1 block text-xs" style={{ color: 'var(--text-muted)' }}>{theme.detail}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === 'profile' && (
        <section aria-labelledby="profile-heading" className="max-w-xl">
          <h2 id="profile-heading" className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Local profile</h2>
          <p className="mb-5 mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>This name is shown in your TarQ navigation. No account is required.</p>
          <label className="block text-sm font-medium" htmlFor="display-name" style={{ color: 'var(--text-primary)' }}>Display name</label>
          <input
            id="display-name"
            className="mt-2 w-full px-3 text-sm"
            maxLength={48}
            onChange={(event) => setSettings((current) => ({ ...current, displayName: event.target.value }))}
            value={settings.displayName}
          />
          <div className="mt-4 flex items-center gap-3">
            <button type="button" className="btn" onClick={() => updateSettings({ ...settings, displayName: settings.displayName.trim() || 'User' })}><Save size={15} />Save profile</button>
            {saved && <span role="status" className="inline-flex items-center gap-1 text-sm" style={{ color: 'var(--status-ok)' }}><Check size={15} />Saved locally</span>}
          </div>
        </section>
      )}
    </div>
  );
}