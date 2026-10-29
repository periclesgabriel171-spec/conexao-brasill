// Roda sozinha a cada 5 min no Netlify (Scheduled Function)
export const config = { schedule: "*/5 * * * *" };
import { buscar, clima } from "./indicadores.mjs";

const UA = "Mozilla/5.0 (compatible; ConexaoBrasil/1.1)";
const GN = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
// grupo = seção do site: regiao (RS/POA, ideia principal), clima (El Niño e eventos climáticos), economia, mundo (geopolítica e Brasil)
const FEEDS = [
  // Só os 3 principais sites brasileiros: g1, Folha e CNN Brasil (o filtro separa clima e economia)
  { grupo: "economia", fonte: "g1 Economia", url: "https://g1.globo.com/rss/g1/economia/" },
  { grupo: "clima", fonte: "g1 Natureza", url: "https://g1.globo.com/rss/g1/natureza/" },
  { grupo: "economia", fonte: "g1", url: "https://g1.globo.com/rss/g1/" },
  { grupo: "economia", fonte: "Folha Mercado", url: "https://feeds.folha.uol.com.br/mercado/rss091.xml" },
  { grupo: "clima", fonte: "Folha Ambiente", url: "https://feeds.folha.uol.com.br/ambiente/rss091.xml" },
  { grupo: "economia", fonte: "CNN Brasil", url: "https://www.cnnbrasil.com.br/feed/" },
];
const FONTES = new Set(FEEDS.map((f) => f.fonte));
const RE_CLIMA = /el ni[nñ]o|la ni[nñ]a|enchente|inunda|chuva|temporal|ciclone|tornad|furac[aã]o|tuf[aã]o|neve|onda de frio|granizo|vendaval|estiagem|seca\b|onda de calor|frente fria|geada|defesa civil|alerta de (tempestade|chuva)/i;
const RE_ENSO = /el ni[nñ]o|la ni[nñ]a/i;
const secaoDe = (n, grupo) => grupo === "clima" ? "clima" : (grupo === "economia" ? RE_ENSO : RE_CLIMA).test(n.titulo) ? "clima" : grupo;

// ---- Filtro: só economia e clima (Brasil e mundo). Esporte, polícia e famosos ficam de fora ----
const RE_ESPORTE = /futebol|palmeiras|corinthians|flamengo|gr[eê]mio|\bInter\b|vasco|botafogo|cruzeiro|libertadores|brasileir[aã]o|campeonato|rodada|placar|\bgols?\b|olimp[ií]ada|\bNBA\b|\bNFL\b|\bUFC\b|f[oó]rmula 1|\bF1\b|\bBBB\b|novela|reality|celebridade|famos[oa]s?|fofoca|hor[oó]scopo|signo|cantor|cantora|\bshow\b|filme|netflix|viraliz/i;
const RE_POLICIA = /\b(PM|PMs|PRF|PF)\b|pol[ií]cia|\bpres[oa]s?\b|assalt|homic[ií]dio|assassin|tiroteio|furto|latroc|feminic|estupr|sequestr|atropel|esfaquead|baleado|morto a tiros/i;
const RE_TEMPO = /el ni[nñ]o|la ni[nñ]a|clima|clim[aá]tic|chuva|temporal|temporais|tempestade|enchente|inunda|alagamento|cheia|ciclone|furac[aã]o|tornad|onda de frio|nevasca|mon[cç][aã]o|tropical (storm|depression|cyclone)|snow|cold front|tuf[aã]o|granizo|vendaval|estiagem|seca\b|onda de calor|calor|frio|geada|neve|massa de ar|frente fria|previs[aã]o do tempo|temperatura|nevoeiro|ressaca|defesa civil|alerta (de|para)|queimada|inc[eê]ndio florestal|aquecimento global|\bCOP\d+|deslizamento|climate|hurricane|typhoon|drought|flood|heatwave|wildfire|storm|rainfall/i;
const RE_ECON = /econom|infla[cç][aã]o|\bIPCA\b|\bIGP|selic|juros|copom|banco central|\bBC\b|d[oó]lar|c[aâ]mbio|\bPIB\b|ibovespa|bolsa de valores|\bB3\b|mercado financeiro|petr[oó]leo|petrobras|commodit|exporta|importa|tarifa|balan[cç]a comercial|safra|soja|trigo|milho|arroz|agroneg|agropecu[aá]ria|frete|combust[ií]vel|gasolina|diesel|energia el[eé]trica|desemprego|emprego|sal[aá]rio m[ií]nimo|renda|cr[eé]dito|d[ií]vida p[uú]blica|fiscal|or[cç]amento|imposto|tribut|\bFed\b|\bBCE\b|\bFMI\b|\bOCDE\b|\bOMC\b|\bOpep\b|recess[aã]o|varejo|ind[uú]stria|supermercado|cesta b[aá]sica|custo de vida|aluguel|financiamento|invest|lucro|faturamento|mercado|a[cç][oõ]es|bitcoin|guerra comercial|san[cç][oõ]es|embargo|ormuz|mar vermelho|ucr[aâ]nia|oriente m[eé]dio|taiwan|inflation|interest rate|central bank|tariff|\boil\b|trade war|economy|stocks|\bGDP\b|recession|sanctions|markets?/i;
export const relevante = (n, grupo) => {
  const tx = n.titulo + " " + (n.desc || "").slice(0, 160);
  if (RE_ESPORTE.test(n.titulo)) return false;
  const tempo = RE_TEMPO.test(tx);
  if (RE_POLICIA.test(n.titulo) && !tempo) return false;
  return grupo === "clima" ? tempo : (tempo || RE_ECON.test(tx));
};
const JANELA_MS = 48 * 3600 * 1000; // guarda 48h (o site destaca as 24h e completa com as anteriores)
const JANELA_CLIMA_MS = 7 * 24 * 3600 * 1000; // clima/El Niño fica 7 dias (boletins são esparsos)
let ERROS = [];
const POR_RODADA = 5;               // manchetes por pedido ao Gemini (lote)
const { SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY, GEMINI_MODEL = "gemini-2.5-flash" } = process.env;

const limpa = (s = "") => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#8217;|&#039;|&#39;/g, "’").replace(/&#8211;/g, "–").replace(/&lt;|&gt;/g, " ").replace(/\s+/g, " ").trim();
const tag = (x, t) => (x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, "i")) || [])[1] || "";

async function lerFeed({ fonte, url, grupo, gn }) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) { console.log("feed falhou", fonte, r.status); return []; }
    const xml = await r.text();
    const itens = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || [];
    return itens.slice(0, 40).map((i) => {
      const d = new Date(limpa(tag(i, "pubDate") || tag(i, "published") || tag(i, "updated") || tag(i, "dc:date")));
      return {
        fonte,
        titulo: limpa(tag(i, "title")),
        link: limpa(tag(i, "link")) || (i.match(/<link[^>]+href="([^"]+)"/i) || [])[1] || "",
        desc: limpa(tag(i, "description") || tag(i, "summary")).slice(0, 700),
        publicado_em: (isNaN(d) ? new Date() : d).toISOString(),
      };
    }).filter((n) => n.titulo && n.link).map((n) => {
      const k = gn ? n.titulo.lastIndexOf(" - ") : -1; // Google Notícias: "Título - Veículo"
      if (k > 0) { n.fonte = n.titulo.slice(k + 3); n.titulo = n.titulo.slice(0, k); }
      n.secao = secaoDe(n, grupo); n.grupo = grupo; return n;
    });
  } catch (e) { console.log("feed erro", fonte, e.message); return []; }
}

const CONTEXTO = `Você é analista de economia e geopolítica focado em PORTO ALEGRE (RS). Contexto da cidade: capital gaúcha; economia de serviços, comércio, saúde, educação e tecnologia; indústria na região metropolitana; porto e Lago Guaíba; ligação forte com o agro gaúcho (soja, arroz, carne, leite) e exportações do RS (calçados, máquinas, tabaco); sensível a dólar, juros, clima (enchentes de 2024) e custo de vida. Em notícias de clima, lembre que o El Niño tende a trazer chuva acima da média ao RS e a La Niña tende a trazer estiagem; avalie risco de enchente, safra e abastecimento.`;
const CAMPOS = `relevante (true ou false: true somente se a notícia trata de economia ou de clima/tempo, no Brasil ou no mundo; false para esporte, polícia/crime, entretenimento, fofoca ou política sem efeito econômico),
tema (Porto Alegre, Rio Grande do Sul, Brasil, Energia, EUA, China, Europa, Oriente Médio, Comércio, Juros, Mercados, Clima ou Outros),
escopo (mundo, brasil, rs ou poa: de onde vem a notícia),
resumo (até 30 palavras, com suas palavras),
poa (até 45 palavras: o que esta notícia muda ou pode mudar em Porto Alegre, direto ao ponto; se o efeito for pequeno ou indireto, diga isso),
brasil (até 30 palavras: leitura nacional),
economia (80 a 110 palavras, linguagem simples, cadeia causa → consequência até o bolso do porto-alegrense e os negócios da cidade: preços, emprego, comércio, indústria, agro gaúcho, exportações, turismo),
horizonte (curto, medio ou longo prazo),
intensidade (inteiro de 0 a 100: relevância estimada desta notícia para Porto Alegre),
efeitos (lista de 3 a 4 objetos {indicador, direcao, forca, motivo}: indicador = Custo de vida, Dólar, Juros, Emprego, Comércio, Indústria, Agro gaúcho, Exportações, Turismo ou Bolsa; direcao = "sobe", "desce" ou "incerto" (o que acontece com esse indicador EM PORTO ALEGRE); forca = inteiro de 0 a 100; motivo em até 14 palavras).
Não recomende investimentos e não invente números, datas ou estatísticas: intensidade e forca são estimativas qualitativas.`;

async function gemini(prompt) {
  let r, txt = "";
  for (const m of [GEMINI_MODEL, "gemini-flash-latest"]) { // se o modelo padrão não existir mais, tenta o "latest"
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
    });
    if (r.ok) break;
    txt = await r.text();
    if (r.status !== 404) break;
  }
  if (!r.ok) throw new Error("Gemini " + r.status + " " + txt.slice(0, 200));
  const j = await r.json();
  return JSON.parse(j.candidates[0].content.parts[0].text);
}

// Analisa várias manchetes em UM pedido ao Gemini (economiza o limite grátis). Devolve [[notícia, análise], ...]
export async function analisarLote(lista) {
  const itens = lista.map((n, i) => `${i + 1}) "${n.titulo}" — trecho: "${(n.descricao || "").slice(0, 400)}"`).join("\n");
  const j = await gemini(`${CONTEXTO}\nNotícias:\n${itens}\nResponda SÓ em JSON, em português do Brasil: uma LISTA com um objeto por notícia, na mesma ordem, cada objeto com a chave n (número da notícia) e as chaves:\n${CAMPOS}`);
  const arr = Array.isArray(j) ? j : (Object.values(j).find(Array.isArray) || [j]);
  return lista.map((p, i) => [p, arr.find((x) => x && +x.n === i + 1) || arr[i]]);
}

export const sb = (path, opt = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  ...opt, headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json", ...(opt.headers || {}) },
});
const pct = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
const PATCH = (id, o) => sb(`noticias?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(o) });

// Grava a análise de uma notícia. manter=true (toque do usuário): não descarta mesmo que a IA ache irrelevante.
export async function gravar(p, a, manter) {
  const inten = pct(a.intensidade);
  if (a.relevante === false && !manter) return (await PATCH(p.id, { secao: "descartada", resumo: "descartada", intensidade: 0, nivel: "baixo" })).ok;
  const r = await PATCH(p.id, { tema: a.tema, escopo: a.escopo, resumo: a.resumo, portoalegre: a.poa, brasil: a.brasil, economia: a.economia, horizonte: a.horizonte, intensidade: inten,
    nivel: inten >= 67 ? "alto" : inten >= 34 ? "medio" : "baixo", efeitos: (a.efeitos || []).map((e) => ({ ...e, forca: pct(e.forca) })) });
  if (!r.ok) console.log("erro PATCH", r.status);
  return r.ok;
}

// Boletim do dia: 1 pedido por dia ("o que o clima e a economia de hoje significam para Porto Alegre")
async function boletim(forcar) {
  const br = new Date(Date.now() - 3 * 3600 * 1000), dia = br.toISOString().slice(0, 10); // horário de Brasília
  if (br.getUTCHours() < 6 && !forcar) return "boletim: ainda cedo";
  const ja = await (await sb(`boletim?dia=eq.${dia}&select=dia`)).json();
  if (!Array.isArray(ja)) return "boletim: ERRO (rode o supabase.sql)";
  if (ja.length) return "boletim: de hoje já pronto";
  const desde = encodeURIComponent(new Date(Date.now() - 24 * 3600 * 1000).toISOString());
  const [ind, cl, rt] = await Promise.all([buscar(), clima(), sb(`noticias?secao=in.(clima,economia)&publicado_em=gte.${desde}&order=publicado_em.desc&limit=12&select=titulo`)]);
  const tit = await rt.json(), dados = [
    cl && `Clima em Porto Alegre agora: ${cl.temp}°C, mínima ${cl.min}°C, máxima ${cl.max}°C, chance de chuva hoje ${cl.chuva}%, vento ${cl.vento} km/h`,
    ind.dolar && `Dólar: R$ ${ind.dolar.valor}`, ind.selic && `Selic: ${ind.selic.valor}% ao ano`, ind.ipca && `IPCA em 12 meses: ${ind.ipca.valor}%`].filter(Boolean).join("\n");
  const j = await gemini(`${CONTEXTO}\nEscreva o BOLETIM DO DIA para quem mora ou trabalha em Porto Alegre: o que o clima e a economia de hoje significam para a cidade. Use SÓ os dados e manchetes abaixo; não invente números e não recomende investimentos.\nDados:\n${dados}\nManchetes das últimas 24h:\n${(Array.isArray(tit) ? tit : []).map((x) => "- " + x.titulo).join("\n")}\nResponda SÓ em JSON com: titulo (até 12 palavras, direto) e texto (90 a 130 palavras, linguagem simples, português do Brasil).`);
  if (!j.titulo || !j.texto) return "boletim: resposta vazia";
  const r = await sb("boletim?on_conflict=dia", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ dia, titulo: j.titulo, texto: j.texto }) });
  return r.ok ? "boletim: criado" : "boletim: ERRO ao salvar " + r.status;
}

export default async (opts) => {
  ERROS = [];
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return "FALTAM as variáveis SUPABASE_URL e SUPABASE_SERVICE_KEY no Netlify";
  await sb("status_busca?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: 1, ultima_execucao: new Date().toISOString() }) }).catch(() => {});
  const desde = new Date(Date.now() - JANELA_MS).toISOString();
  const desdeClima = new Date(Date.now() - JANELA_CLIMA_MS).toISOString();

  // 1) Salva na hora tudo que saiu nas últimas 24h (sem esperar a IA) — duplicados são ignorados
  const novas = [...new Map((await Promise.all(FEEDS.map(lerFeed))).flat()
    .filter((n) => relevante(n, n.grupo) && n.publicado_em >= (n.secao === "clima" ? desdeClima : desde)).map((n) => [n.link, n])).values()];
  let salvo = "salvo ok";
  if (novas.length) {
    const r = await sb("noticias?on_conflict=link", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(novas.map((n) => ({ link: n.link, titulo: n.titulo, fonte: n.fonte, publicado_em: n.publicado_em, descricao: n.desc, secao: n.secao }))) });
    if (!r.ok) { salvo = "ERRO ao salvar " + r.status + " " + await r.text(); console.log(salvo); }
  }

  // 1b) limpa o que já estava salvo e não é economia/clima (marca como descartada, sem apagar)
  let limpas = 0;
  const rr = await sb(`noticias?or=${encodeURIComponent("(secao.is.null,secao.neq.descartada)")}&publicado_em=gte.${encodeURIComponent(desdeClima)}&select=id,titulo,descricao,secao,fonte&limit=500`);
  const lin = await rr.json();
  if (Array.isArray(lin)) {
    const ids = lin.filter((x) => x.secao === "regiao" || !FONTES.has(x.fonte) || !relevante({ titulo: x.titulo, desc: x.descricao }, x.secao || "economia")).map((x) => x.id);
    if (ids.length) {
      const r2 = await sb(`noticias?id=in.(${ids.join(",")})`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ secao: "descartada", resumo: "descartada", intensidade: 0, nivel: "baixo" }) });
      if (r2.ok) limpas = ids.length;
    }
  }

  // 2) Uma vez por hora (ou ao abrir /agora): análise em LOTE (5 manchetes por pedido) + boletim do dia.
  //    As demais notícias só são analisadas quando alguém toca em "Mais detalhes" (função detalhe).
  const hora = (opts && opts.forcar) || new Date().getMinutes() < 5;
  let ok = 0, pend = [], bol = "boletim: aguardando a próxima hora cheia";
  if (hora) {
    const rp = await sb(`noticias?resumo=is.null&publicado_em=gte.${encodeURIComponent(desdeClima)}&order=publicado_em.desc&limit=30&select=id,titulo,descricao,secao`);
    pend = await rp.json();
    if (!Array.isArray(pend)) return console.log("erro ao ler pendentes", JSON.stringify(pend));
    const ordem = { regiao: 0, clima: 0, economia: 1, mundo: 2 }; // clima primeiro
    pend.sort((a, b) => (ordem[a.secao] ?? 2) - (ordem[b.secao] ?? 2)); pend.splice((opts && opts.porRodada) || POR_RODADA);
    try { if (pend.length) for (const [p, a] of await analisarLote(pend)) if (a && await gravar(p, a)) ok++; }
    catch (e) { ERROS.push(e.message); console.log("erro análise em lote", e.message); }
    try { bol = await boletim(opts && opts.forcar); } catch (e) { bol = "boletim: ERRO"; ERROS.push(e.message); }
  }
  const msg = `feeds: ${novas.length} nas últimas 48h · ${salvo} · descartadas: ${limpas} · analisadas agora: ${ok}/${pend.length} · ${bol}${ERROS.length ? " · ERROS: " + [...new Set(ERROS)].join(" | ").slice(0, 400) : ""}`;
  console.log(msg); return msg;
};
