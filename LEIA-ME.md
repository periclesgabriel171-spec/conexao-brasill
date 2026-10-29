# Conexão Brasil ao vivo — passo a passo (tudo gratuito)

1. **Gemini (IA grátis):** em aistudio.google.com > "Get API key". Guarde a chave.
2. **Supabase:** crie um projeto em supabase.com. Em *SQL Editor*, cole e rode o `supabase.sql`.
   Em *Project Settings > API*, copie: Project URL, chave `anon public` e chave `service_role` (secreta!).
3. **Site:** abra `public/index.html` e troque `SUPABASE_URL` e `ANON_KEY` pelos seus valores.
4. **Netlify:** suba esta pasta (GitHub + "Import project", ou arraste a pasta em app.netlify.com/drop — para a função agendada, o caminho via GitHub é o mais seguro).
   Em *Site configuration > Environment variables* crie:
   - `SUPABASE_URL` (a mesma URL)
   - `SUPABASE_SERVICE_KEY` (a chave service_role)
   - `GEMINI_API_KEY`
5. Faça um novo deploy. Em *Functions > atualizar* dá para clicar em "Run now" e testar. Depois ela roda sozinha a cada 30 min.

Notas: a service_role NUNCA vai no index.html. Se a Worldview (RANE) não tiver feed, a função só ignora. Cada rodada processa no máximo 5 notícias novas para caber no limite grátis do Gemini.

## Versão 2 (o que mudou)
- Rode de novo o `supabase.sql` (blocos novos no final) **antes** de subir o deploy.
- A função agora roda a cada 10 min, salva tudo das últimas 24h na hora e a IA analisa em lotes de 6 por rodada (cards sem análise mostram "preparando").
- Fontes novas: Bloomberg, Financial Times e CNBC. Reuters não tem RSS público.
- Opcional: variável `GEMINI_MODEL` (ex.: `gemini-2.5-flash-lite`) se aparecer erro 429 nos logs.

## Versão 3 — foco em Porto Alegre
- Rode de novo o `supabase.sql` (2 colunas novas) antes do deploy.
- Novas fontes: Agência Brasil, g1 Economia/RS, Folha Mercado, InfoMoney, Exame, CNN Brasil, Poder360, GZH e Correio do Povo. Se algum feed falhar, aparece "feed falhou" nos logs da função e ele é ignorado; ajuste a URL em `FEEDS`.
- A IA agora diz o que muda em Porto Alegre e a nota de relevância é para a cidade.

## Versão 4 — visual novo
- Tema claro com tipografia condensada (Anton via Google Fonts), gradiente no topo e rótulos em mono.
- Logo e favicon (bandeira do RS estilizada) em `public/` (favicon.svg, favicon.ico, apple-touch-icon.png).

## Versão 5 — região em primeiro, clima ao vivo e economia separada
- Rode de novo o `supabase.sql` (coluna `secao`) **antes** do deploy.
- O site agora tem 4 seções: **Região** (RS/POA, a principal), **Clima** (El Niño e eventos extremos), **Economia** (separada) e **Mundo** (geopolítica e Brasil).
- Clima/El Niño: MetSul, INMET Avisos e duas buscas do Google Notícias (El Niño/La Niña e alertas de chuva no RS). Notícias de clima ficam 7 dias no site; as demais, 24h.
- A função roda a cada 5 min e a IA analisa Região e Clima primeiro (3 por rodada). Notícia de qualquer fonte que cite chuva, temporal, enchente, El Niño etc. vai para Clima.
- Os feeds novos não foram testados fora do seu deploy: se algum falhar, aparece "feed falhou" nos logs e ele é ignorado; ajuste a URL em `FEEDS`.

## Versão 6 — visual escuro e moderno
- Fundos novos em `public/img/` (globo.jpg, pessoas.jpg, parede.jpg). Os t1/t2/t3 antigos saíram.
- Hero com parallax, faixa de manchetes, alerta de Porto Alegre ao vivo e cards com luz que segue o mouse.

## Versão 7
- Só clima (Brasil e mundo) e economia. Aba Economia no canto, com cards ilustrativos.
- Abertura: vídeo da mão com o globo em `public/img/abertura.mp4` (fundo do hero, com transição gradual).

## Versão 8 — economia de IA, dados ao vivo e GitHub
- Rode de novo o `supabase.sql` (tabelas `boletim` e `status_busca`) **antes** do deploy.
- **Variável nova no Netlify:** `CHAVE_ATUALIZAR` (a senha da página `/.netlify/functions/agora?k=SENHA`). A senha antiga que estava no código foi removida, porque o código vai para o GitHub.
- IA: a cada hora cheia, 1 pedido analisa 5 manchetes de uma vez; 1 pedido por dia escreve o **Boletim do dia** (card de destaque); as outras notícias só são analisadas quando alguém toca em "Mais detalhes" (função `detalhe`).
- Sem IA: clima de Porto Alegre (Open-Meteo, direto no navegador) e dólar, Selic e IPCA (Banco Central, pela função `indicadores`).
- Topo mostra "busca automática há X min" (avisa se passar de 15 min).
- Prévia do WhatsApp: tags Open Graph + `img/og.jpg`. O endereço do site é preenchido no deploy pelo `netlify.toml` (só funciona via GitHub).
- Publicar pelo GitHub: crie um repositório **privado**, suba o conteúdo desta pasta (não o zip) e, no Netlify, "Add new site > Import from Git". Recoloque as 4 variáveis de ambiente.
