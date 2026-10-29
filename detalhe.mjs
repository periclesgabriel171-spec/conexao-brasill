// Análise sob demanda: roda a IA só para a notícia em que a pessoa tocou "Mais detalhes" e guarda o resultado.
import { sb, analisarLote, gravar } from "./atualizar.mjs";
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
const ler = async (id) => { const r = await sb(`noticias?id=eq.${id}&select=*`); const l = await r.json().catch(() => []); return Array.isArray(l) ? l[0] : null; };
export default async (req) => {
  const id = parseInt(new URL(req.url).searchParams.get("id"), 10);
  if (!id) return J({ erro: "id inválido" }, 400);
  const n = await ler(id);
  if (!n) return J({ erro: "notícia não encontrada" }, 404);
  if (n.resumo) return J(n);
  try {
    const [[, a]] = await analisarLote([n]);
    if (!a) throw new Error("IA sem resposta");
    await gravar(n, a, true);
    return J(await ler(id));
  } catch (e) { console.log("detalhe erro", e.message); return J({ erro: e.message }, 502); }
};
