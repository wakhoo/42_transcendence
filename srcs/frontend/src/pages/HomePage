import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

// Illustration SVG du tableau de dessin — composant séparé pour garder le JSX lisible
function SketchIllustration() {
  return (
    <svg
      width="340" height="200" viewBox="0 0 340 200"
      role="img" aria-label="Illustration d'un tableau de dessin Pictionary"
      style={{ display: 'block', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.12))' }}
    >
      {/* Cadre du tableau */}
      <rect x="20" y="15" width="300" height="170" rx="10" fill="#1a1a2e" />
      <rect x="30" y="25" width="280" height="150" rx="6" fill="#0f172a" />

      {/* Dessin soleil */}
      <circle cx="100" cy="80" r="22" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeDasharray="3 2" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = 100 + 30 * Math.cos(rad);
        const y1 = 80 + 30 * Math.sin(rad);
        const x2 = 100 + 38 * Math.cos(rad);
        const y2 = 80 + 38 * Math.sin(rad);
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />;
      })}

      {/* Dessin maison */}
      <polyline
        points="190,130 190,95 215,75 240,95 240,130"
        fill="none" stroke="#60a5fa" strokeWidth="2.5"
        strokeLinejoin="round" strokeLinecap="round"
      />
      <line x1="190" y1="130" x2="240" y2="130" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="207" y="108" width="16" height="22" rx="2" fill="none" stroke="#60a5fa" strokeWidth="2" />

      {/* Bulle "?" */}
      <rect x="255" y="55" width="45" height="28" rx="8" fill="#7c3aed" opacity="0.92" />
      <text x="278" y="74" textAnchor="middle" fill="white" fontSize="16" fontFamily="system-ui" fontWeight="500">?</text>
      <polygon points="265,83 272,80 268,90" fill="#7c3aed" opacity="0.92" />

      {/* Trait animé en cours de dessin */}
      <path
        d="M145 140 Q158 125 170 135 Q180 143 188 138"
        stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round" fill="none"
        strokeDasharray="200" strokeDashoffset="200"
      >
        <animate attributeName="strokeDashoffset" from="200" to="0" dur="1.8s" begin="0.5s" fill="freeze" />
      </path>

      {/* Crayon au bout du trait */}
      <g transform="translate(188,138) rotate(-45)">
        <rect x="-4" y="-18" width="8" height="20" rx="2" fill="#f59e0b" />
        <polygon points="-4,2 4,2 0,9" fill="#fde68a" />
        <rect x="-4" y="-22" width="8" height="5" rx="1" fill="#d1d5db" />
      </g>
    </svg>
  );
}

const STEPS = [
  { num: '01', emoji: '🎨', titleKey: 'home.step1_title', descKey: 'home.step1_desc' },
  { num: '02', emoji: '✏️', titleKey: 'home.step2_title', descKey: 'home.step2_desc' },
  { num: '03', emoji: '💬', titleKey: 'home.step3_title', descKey: 'home.step3_desc' },
  { num: '04', emoji: '🏆', titleKey: 'home.step4_title', descKey: 'home.step4_desc' },
];

export function HomePage() {
  const { t } = useTranslation();

  return (
    <div className="home-page">

      {/*HEADER s,il vous convient*/}
      <header className="home-header">
        <div className="home-logo">
          {/* Icône dessin simple */}
          <div className="home-logo-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 14 Q6 8 9 10 Q12 12 15 4" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" />
              <circle cx="3" cy="14" r="1.5" fill="#c084fc" />
            </svg>
          </div>
          <span className="home-logo-name">ft_transcendence</span>
        </div>

        {/* Sélecteur de langue fr ar en de il y a encore un fichier pour ca */}
        <LanguageSwitcher />
      </header>

      {/* hero */}
      <main className="home-hero">
        <SketchIllustration />

        {/* Badge projet 42 ou à retirer c'est optionnel */}
        <span className="home-badge">
          <span className="home-badge-dot" aria-hidden="true" />
          {t('home.badge')}
        </span>

        {/* Titre : deux lignes, la 2e en violet mais on peut toujours modifier si vous aimez pas */}
        <h1 className="home-title">
          {t('home.title')}{' '}
          <em className="home-title-accent">{t('home.title_accent')}</em>
        </h1>

        <p className="home-desc">{t('home.desc')}</p>

        {/* CTAs */}
        <div className="home-cta-row">
          {/* "Jouer" /game (protégé : redirigera vers /login si pas connecté) */}
          <Link to="/game" className="home-btn-play">{t('home.cta_play')}</Link>
          {/* "Se connecter" /login */}
          <Link to="/login" className="home-btn-login">{t('home.cta_login')}</Link>
        </div>
      </main>

      {/* Fonctionnement */}
      <section className="home-how" aria-labelledby="how-heading">
        <p className="home-how-label" id="how-heading">{t('home.how_title')}</p>
        <div className="home-steps" role="list">
          {STEPS.map((step) => (
            <div className="home-step" role="listitem" key={step.num}>
              <p className="home-step-num">{step.num}</p>
              <span className="home-step-emoji" aria-hidden="true">{step.emoji}</span>
              <h3 className="home-step-title">{t(step.titleKey)}</h3>
              <p className="home-step-desc">{t(step.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/*Footer et RGPD à voir avec @chajeon */}
      <footer className="home-footer">
        <span className="home-footer-text">{t('footer.made_with')}</span>
        <nav className="home-footer-links" aria-label="Liens légaux">
          <a href="/privacy-policy.html">{t('footer.privacy')}</a>
          <a href="/terms-of-service.html">{t('footer.terms')}</a>
        </nav>
      </footer>

    </div>
  );
}
