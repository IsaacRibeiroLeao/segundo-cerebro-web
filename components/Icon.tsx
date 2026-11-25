type Nome = "hoje" | "notas" | "conversar" | "mapa" | "sair" | "apagar" | "editar";

const imagens: Partial<Record<Nome, string>> = {
  hoje: "/icons/tab-hoje.png",
  notas: "/icons/tab-notas.png",
  conversar: "/icons/tab-conversar.png",
  mapa: "/icons/tab-mapa.png",
};

const tracos: Record<"sair" | "apagar" | "editar", string> = {
  sair: "M10 4H5v16h5M15 8l4 4-4 4M19 12H9",
  apagar: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
  editar: "M4 20l1-5L16 4l4 4L9 19z",
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
