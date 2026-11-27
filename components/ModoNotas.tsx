import Link from "next/link";

// Notas e Timeline são duas visões da mesma coisa.
export function ModoNotas({ atual }: { atual: "lista" | "tempo" }) {
  const item = (href: string, nome: string, on: boolean) => (
    <Link href={href} aria-current={on ? "page" : undefined}
      className={`press rounded-xl px-3 py-1.5 transition ${on ? "btn-accent font-medium" : "text-muted hover:text-ink"}`}>{nome}</Link>
  );
  return (
    <div className="mt-3 inline-flex rounded-2xl border border-line bg-card p-1 text-sm">
      {item("/notas", "Lista", atual === "lista")}
      {item("/linha-do-tempo", "Timeline", atual === "tempo")}
    </div>
  );
}
