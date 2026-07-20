export function ProductArtwork({ label = 'Ilustración de una parrilla encendida', compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div className={`product-artwork ${compact ? 'product-artwork--compact' : ''}`} role="img" aria-label={label}>
      <svg viewBox="0 0 640 560" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="ember-glow" x1="0" x2="1" y1="0" y2="1">
            <stop stopColor="#f2bd4b" />
            <stop offset="0.52" stopColor="#dc542b" />
            <stop offset="1" stopColor="#74251e" />
          </linearGradient>
        </defs>
        <path d="M108 378c65-90 132-137 212-137 85 0 147 45 212 137l-34 86H142l-34-86Z" fill="#1d1b18" />
        <path d="M151 388h338l-26 56H177l-26-56Z" fill="url(#ember-glow)" />
        <g stroke="#f8ead5" strokeWidth="12" strokeLinecap="round" opacity=".94">
          <path d="M184 346 258 278" /><path d="M260 356 334 270" /><path d="M340 356 414 278" />
        </g>
        <g fill="#f2bd4b"><circle cx="204" cy="414" r="8" /><circle cx="251" cy="426" r="6" /><circle cx="364" cy="409" r="8" /><circle cx="427" cy="427" r="6" /></g>
        <path d="M279 238c-29-32-8-74 22-94-7 34 30 45 22 84-6 28-28 35-44 10Zm71 2c-25-28-8-58 16-77-4 27 24 39 17 68-5 22-21 29-33 9Z" fill="#dc542b" />
      </svg>
      {!compact && <span className="product-artwork__caption">Fuego lento, sabor decidido.</span>}
    </div>
  );
}
