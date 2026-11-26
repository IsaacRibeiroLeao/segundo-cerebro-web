type Nome = "hoje" | "notas" | "conversar" | "mapa" | "tempo" | "microfone" | "baixar" | "refazer" | "sair" | "apagar" | "editar" | "biblia" | "lua" | "sol" | "busca" | "mais" | "compartilhar" | "seta";

const imagens: Partial<Record<Nome, string>> = {
  hoje: "/icons/tab-hoje.png",
  notas: "/icons/tab-notas.png",
  conversar: "/icons/tab-conversar.png",
  mapa: "/icons/tab-mapa.png",
};

const tracos: Record<"tempo" | "microfone" | "baixar" | "refazer" | "sair" | "apagar" | "editar" | "biblia" | "lua" | "sol" | "busca" | "mais" | "compartilhar" | "seta", string> = {
  tempo: "M12 7v5l3 2M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4",
  microfone: "M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6",
  baixar: "M12 4v11M7 11l5 5 5-5M5 20h14",
  refazer: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  sair: "M10 4H5v16h5M15 8l4 4-4 4M19 12H9",
  apagar: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
  editar: "M4 20l1-5L16 4l4 4L9 19z",
  lua: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",
  sol: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  busca: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  mais: "M12 5v14M5 12h14",
  compartilhar: "M12 3v12M8 7l4-4 4 4M5 13v7h14v-7",
  seta: "M9 6l6 6-6 6",
  biblia: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M10 8h5M12.5 6v5",
};

export function Icon({ nome, className = "w-5 h-5" }: { nome: Nome; className?: string }) {
  const img = imagens[nome];
  if (img) {
    // Ícone em máscara: herda a cor do texto (currentColor), funciona no tema claro e escuro.
    return (
      <span
        aria-hidden="true"
        className={`inline-block bg-current ${className}`}
        style={{
          WebkitMask: `url(${img}) center / contain no-repeat`,
          mask: `url(${img}) center / contain no-repeat`,
        }}
      />
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={tracos[nome as keyof typeof tracos]} />
    </svg>
  );
}
