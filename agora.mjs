// Roda a busca na hora e continua sozinho até analisar tudo. Abra: /.netlify/functions/agora?k=SUA_CHAVE
import atualizar from "./atualizar.mjs";
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const pagina = (txt, seguir, status = 200) => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${seguir ? '<meta http-equiv="refresh" content="35">' : ""}<body style="margin:0;background:#050a16;color:#eaf4ff;font:15px/1.5 system-ui"><pre style="white-space:pre-wrap;padding:18px;margin:0">${esc(txt)}\n\n${seguir ? "Continua sozinho a cada 35 segundos. Deixe esta página aberta até aparecer 'Terminou'." : "Terminou."}</pre>`,
  { status, headers: { "content-type": "text/html; charset=utf-8" } });
export default async (req) => {
  const k = new URL(req.url).searchParams.get("k"), chave = process.env.CHAVE_ATUALIZAR;
  if (!chave || k !== chave) return new Response("Senha errada. Abra /.netlify/functions/agora?k=SUA_SENHA", { status: 401 });
  const txt = await atualizar({ porRodada: 5, forcar: true });
  const m = /analisadas agora: (\d+)\/(\d+)/.exec(txt);
  return pagina(txt, !!(m && +m[1] > 0));
};
