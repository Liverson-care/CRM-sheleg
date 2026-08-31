/** Logo Sheleg — un flocon de neige stylisé (Sheleg = « neige » en hébreu). */
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
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {[0, 60, 120].map((angle) => (
          <g key={angle} transform={`rotate(${angle} 24 24)`}>
            <line x1="24" y1="6" x2="24" y2="42" />
            <line x1="24" y1="12" x2="19" y2="16" />
            <line x1="24" y1="12" x2="29" y2="16" />
            <line x1="24" y1="36" x2="19" y2="32" />
            <line x1="24" y1="36" x2="29" y2="32" />
          </g>
        ))}
      </g>
    </svg>
  );
}
