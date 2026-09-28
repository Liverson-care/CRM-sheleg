/**
 * Marque Sheleg — flocon de neige à 6 branches (Sheleg = « neige » en hébreu).
 * Monochrome (currentColor) : blanc sur la barre foncée, bleu ailleurs.
 * Reprend le flocon du logo : branche centrale, deux paires de ramifications
 * et de petits chevrons en pointe.
 */
export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <g key={angle} transform={`rotate(${angle} 24 24)`}>
            {/* branche principale */}
            <line x1="24" y1="24" x2="24" y2="5" />
            {/* chevrons en pointe */}
            <line x1="24" y1="7.5" x2="19.5" y2="12" />
            <line x1="24" y1="7.5" x2="28.5" y2="12" />
            {/* ramification haute */}
            <line x1="24" y1="13.5" x2="20" y2="17.5" />
            <line x1="24" y1="13.5" x2="28" y2="17.5" />
            {/* ramification basse */}
            <line x1="24" y1="19" x2="21" y2="22" />
            <line x1="24" y1="19" x2="27" y2="22" />
          </g>
        ))}
      </g>
    </svg>
  );
}
