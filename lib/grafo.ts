export type ArestaIdx = { a: number; b: number; s: number };

// Layout de forças simples: repulsão entre todos, atração ao longo das conexões.
export function calcularLayout(n: number, arestas: ArestaIdx[], L: number, A: number) {
  const pos = Array.from({ length: n }, (_, i) => {
    const ang = (i / Math.max(n, 1)) * Math.PI * 2;
    return { x: L / 2 + Math.cos(ang) * L * 0.28, y: A / 2 + Math.sin(ang) * A * 0.3 };
  });
  const escala = L / 800;
  for (let it = 0; it < 300; it++) {
    const f = pos.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const d2 = Math.max(dx * dx + dy * dy, 25);
        const r = (9000 * escala * escala) / d2;
        const d = Math.sqrt(d2);
        f[i].x += (dx / d) * r;
        f[i].y += (dy / d) * r;
        f[j].x -= (dx / d) * r;
        f[j].y -= (dy / d) * r;
      }
    }
    for (const e of arestas) {
      const dx = pos[e.b].x - pos[e.a].x;
      const dy = pos[e.b].y - pos[e.a].y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const k = (d - 110 * escala) * 0.02 * (0.5 + e.s);
      f[e.a].x += (dx / d) * k;
      f[e.a].y += (dy / d) * k;
      f[e.b].x -= (dx / d) * k;
      f[e.b].y -= (dy / d) * k;
    }
    for (let i = 0; i < n; i++) {
      f[i].x += (L / 2 - pos[i].x) * 0.012;
      f[i].y += (A / 2 - pos[i].y) * 0.012;
      const passo = 12 * escala;
      pos[i].x = Math.min(L - 50, Math.max(50, pos[i].x + Math.max(-passo, Math.min(passo, f[i].x))));
      pos[i].y = Math.min(A - 50, Math.max(40, pos[i].y + Math.max(-passo, Math.min(passo, f[i].y))));
    }
  }
  return pos;
}

const PALETA = ["#b8742f", "#5b7f5a", "#9a4f73", "#3f7490", "#a8923a", "#7a5a9a", "#4f8a78", "#b05a48"];

export function corDoTema(chave: string | null) {
  if (!chave) return "#8d8272";
  let h = 0;
  for (const c of chave) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
}
