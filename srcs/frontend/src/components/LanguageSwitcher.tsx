import { useTranslation } from 'react-i18next';

const LANGS = [
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'de', label: 'DE', name: 'Deutsch' },
  { code: 'ar', label: 'AR', name: 'العربية' },
] as const;

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language.slice(0, 2);

  function change(code: string) {
    i18n.changeLanguage(code);
    document.documentElement.setAttribute('dir', code === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', code);
  }

  return (
    <div className="language-switcher" role="group" aria-label="Choisir la langue">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => change(l.code)}
          className={`lang-btn${current === l.code ? ' lang-btn--active' : ''}`}
          aria-pressed={current === l.code}
          title={l.name}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
