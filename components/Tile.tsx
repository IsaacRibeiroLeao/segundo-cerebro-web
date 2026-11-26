import { Icon } from "./Icon";

type NomeIcone = Parameters<typeof Icon>[0]["nome"];

// Ícone dentro de um quadradinho com contorno dourado; "ativo" enche de ouro.
export function Tile({ nome, tamanho = 36, ativo = false, className = "" }: { nome: NomeIcone; tamanho?: number; ativo?: boolean; className?: string }) {
  return (
    <span className={`tile ${ativo ? "tile-on" : ""} ${className}`} style={{ width: tamanho, height: tamanho }}>
      <Icon nome={nome} className="h-[55%] w-[55%]" />
    </span>
  );
}
