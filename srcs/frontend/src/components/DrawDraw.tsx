
interface DrawDrawLogoProps {
  className?: string;
}

export default function DrawDrawLogo({
  className = "",
}: DrawDrawLogoProps) {
  return (
    <div
      className={`drawdraw-logo ${className}`}
      aria-label="DrawDraw"
    >
      <svg
        viewBox="0 0 300 90"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto overflow-visible"
      >
        {/* Petit personnage */}
        <g className="drawdraw-character">
          <circle
            cx="25"
            cy="27"
            r="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />

          {/* sourire */}
          <path
            d="M20 28 Q25 34 30 28"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* corps */}
          <path
            d="M25 37 Q22 50 25 62"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* bras */}
          <path
            d="M24 43 Q12 48 9 40"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />

          <path
            d="M26 43 Q38 38 45 30"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* jambes */}
          <path
            d="M25 62 L15 75"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />

          <path
            d="M25 62 L36 75"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* crayon */}
          <g className="drawdraw-pencil">
            <path
              d="M39 31 L58 10"
              stroke="#facc15"
              strokeWidth="7"
              strokeLinecap="round"
            />

            <path
              d="M56 8 L61 3 L62 12 Z"
              fill="#f97316"
            />
          </g>
        </g>

        {/* Texte */}
        <text
          x="65"
          y="58"
          className="drawdraw-text"
          fill="currentColor"
          fontSize="48"
          fontWeight="900"
          fontFamily="Comic Sans MS, Comic Sans, cursive"
        >
          DrawDraw
        </text>

        {/* Soulignement dessiné à la main */}
        <path
          className="drawdraw-underline"
          d="M67 68 Q145 77 235 67 Q260 64 285 68"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* petites étoiles/doodles */}
        <path
          className="drawdraw-spark"
          d="M75 15 L78 21 L84 23 L78 25 L75 31 L72 25 L66 23 L72 21 Z"
          fill="#facc15"
        />

        <circle
          className="drawdraw-dot"
          cx="250"
          cy="20"
          r="4"
          fill="#6366f1"
        />

        <path
          className="drawdraw-spark"
          d="M270 35 L273 40 L279 42 L273 44 L270 50 L267 44 L261 42 L267 40 Z"
          fill="#f97316"
        />
      </svg>
    </div>
  );
}