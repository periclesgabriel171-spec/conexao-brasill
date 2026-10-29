// Dólar, Selic e IPCA (Banco Central, grátis) + clima de Porto Alegre (Open-Meteo, grátis). Sem IA.
const BCB = (s, n) => fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${s}/dados/ultimos/${n}?formato=json`, { signal: AbortSignal.timeout(8000) })
  .then((r) => r.json()).then((a) => a.map((x) => ({ data: x.data, valor: parseFloat(x.valor) }))).catch(() => null);
const fim = (a) => (a && a.length ? a[a.length - 1] : null);
export async function buscar() {
  const [d, s, i] = await Promise.all([BCB(1, 2), BCB(432, 1), BCB(13522, 1)]); // 1 = dólar venda, 432 = meta Selic, 13522 = IPCA 12 meses
  return { dolar: fim(d) && { ...fim(d), antes: d.length > 1 ? d[0].valor : null }, selic: fim(s), ipca: fim(i) };
}
export async function clima() {
  try {
    const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=-30.03&longitude=-51.23&current=temperature_2m,wind_speed_10m,weather_code&daily=precipitation_probability_max,temperature_2m_max,temperature_2m_min&timezone=America%2FSao_Paulo&forecast_days=1", { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    return { temp: j.current.temperature_2m, vento: j.current.wind_speed_10m, chuva: j.daily.precipitation_probability_max[0], max: j.daily.temperature_2m_max[0], min: j.daily.temperature_2m_min[0] };
  } catch { return null; }
}
export default async () => new Response(JSON.stringify(await buscar()), { headers: { "content-type": "application/json", "cache-control": "public, max-age=600" } });
