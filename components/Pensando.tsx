export function Pensando({ texto = "Pensando" }: { texto?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted" role="status" aria-live="polite">
      {texto}
      <span className="inline-flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-accent"
            style={{ animation: "dots 1.1s infinite ease-in-out", animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
    </span>
  );
}

export function Esqueleto({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="shimmer h-3.5 rounded-full" style={{ width: `${95 - i * 18}%` }} />
      ))}
    </div>
  );
}
