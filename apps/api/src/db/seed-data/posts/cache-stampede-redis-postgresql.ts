export const CACHE_STAMPEDE_REDIS_POSTGRESQL_POST = {
  slug: 'cache-stampede-redis-postgresql',
  coverImage: 'posts/cache-stampede.png',
  title: 'Cache stampede: quando o cache derruba o banco',
  excerpt:
    'Quando uma chave popular expira sob tráfego alto, o cache que deveria proteger o banco pode virar o gatilho da queda.',
  content: `## O paradoxo do cache

Cache existe para proteger o banco. Mas existe um cenário onde o cache, ao expirar, provoca exatamente o ataque de leitura que foi criado para evitar. Esse cenário tem nome: **cache stampede** — também chamado de thundering herd.

O mecanismo é simples: uma chave popular expira no Redis. No mesmo instante, dezenas ou centenas de requests chegam simultaneamente, encontram cache miss, e todas vão ao banco buscar o mesmo dado. O banco recebe uma explosão de queries idênticas. Se for uma query cara — junção de tabelas, agregação, subquery — o banco pode saturar.

O problema não é o cache falhar. É que o cache deixou de servir como buffer e todos os requests chegaram ao banco ao mesmo tempo.

## Por que acontece com mais frequência do que parece

O TTL é o culpado direto. Quando você define \`TTL = 300\` para uma chave popular, todos os usuários que buscaram esse dado nos últimos 5 minutos têm um cache quente. Quando o TTL expira, o cache esfria para todo mundo ao mesmo tempo.

Em tráfego alto, o intervalo entre a expiração e o próximo set de cache é onde o problema acontece. Esse intervalo pode ser de milissegundos, mas em 10.000 requests por segundo é o suficiente para centenas de queries simultâneas chegarem ao banco.

\`\`\`
t=0       → TTL de /posts/featured expira
t=0+1ms   → 50 requests simultâneos chegam, encontram miss
t=0+1ms   → 50 queries idênticas chegam ao PostgreSQL
t=0+150ms → a query mais lenta termina, todos os 50 fazem SET no Redis
t=0+150ms → 49 desses SETs são redundantes
\`\`\`

## Solução 1: lock distribuído na revalidação

A abordagem mais direta é garantir que só um processo faça a query ao banco quando a chave expirar. Os demais aguardam.

\`\`\`typescript
async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as T;

  const lockKey = \`lock:\${key}\`;
  const acquired = await redis.set(lockKey, '1', 'NX', 'PX', 5000); // lock de 5s

  if (acquired) {
    try {
      const data = await fetcher();
      await redis.setex(key, ttl, JSON.stringify(data));
      return data;
    } finally {
      await redis.del(lockKey);
    }
  }

  // Outro processo está buscando — aguarda e tenta novamente
  await sleep(100);
  return getCachedOrFetch(key, fetcher, ttl);
}
\`\`\`

O problema desta abordagem: se o lock holder demorar muito (query lenta, timeout), os outros requests ficam em espera. É necessário um fallback para casos onde o lock expira sem o dado ser preenchido.

## Solução 2: probabilistic early reexpiration

Uma abordagem que evita locks é expirar a chave **antes** do TTL real, de forma probabilística, quando o request chega perto do vencimento.

O princípio: quando restam X segundos para expirar, existe uma probabilidade crescente de que o request atual revalide o cache em vez de servir o dado cacheado. Os outros requests continuam recebendo o dado antigo enquanto um processo faz a query.

\`\`\`typescript
interface CacheEntry<T> {
  data: T;
  expiresAt: number;      // timestamp real de expiração (unix segundos)
  computationTime: number; // quanto tempo levou para gerar (segundos)
}

async function fetchWithEarlyReexpiration<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,
  beta = 1
): Promise<T> {
  const raw = await redis.get(key);
  const now = Date.now() / 1000;

  if (raw) {
    const entry: CacheEntry<T> = JSON.parse(raw);
    // Probabilidade de revalidar aumenta conforme o TTL se aproxima do fim
    const shouldRevalidate =
      now - beta * entry.computationTime * Math.log(Math.random()) > entry.expiresAt;

    if (!shouldRevalidate) {
      return entry.data;
    }
  }

  const start = Date.now();
  const data = await fetcher();
  const computationTime = (Date.now() - start) / 1000;

  const entry: CacheEntry<T> = {
    data,
    expiresAt: now + ttl,
    computationTime,
  };
  // Armazena com TTL estendido para que o dado nunca desapareça abruptamente
  await redis.setex(key, ttl + Math.ceil(beta * computationTime * 10), JSON.stringify(entry));
  return data;
}
\`\`\`

O \`computationTime\` entra na fórmula porque queries mais lentas merecem ser revalidadas mais cedo — há mais a perder se todo mundo chegar ao banco ao mesmo tempo. O parâmetro \`beta\` controla a agressividade da revalidação antecipada.

## Solução 3: stale-while-revalidate

Outra abordagem é nunca expirar a chave do Redis e controlar a validade no nível da aplicação. O dado tem dois timestamps: \`freshUntil\` (quando vale retornar diretamente) e \`staleUntil\` (quando realmente precisa ser descartado).

\`\`\`typescript
interface StaleEntry<T> {
  data: T;
  freshUntil: number;
  staleUntil: number;
}

async function fetchStaleWhileRevalidate<T>(
  key: string,
  fetcher: () => Promise<T>,
  freshTtl: number,  // segundos de dado fresco
  staleTtl: number   // segundos extras de dado obsoleto aceitável
): Promise<T> {
  const raw = await redis.get(key);
  const now = Date.now() / 1000;

  if (raw) {
    const entry: StaleEntry<T> = JSON.parse(raw);

    if (now < entry.freshUntil) {
      return entry.data; // dado fresco, retorna direto
    }

    if (now < entry.staleUntil) {
      // dado obsoleto — retorna imediatamente e revalida em background
      revalidateInBackground(key, fetcher, freshTtl, staleTtl).catch(console.error);
      return entry.data;
    }
  }

  // dado expirado ou ausente — revalida de forma síncrona
  return revalidateInBackground(key, fetcher, freshTtl, staleTtl);
}
\`\`\`

O tradeoff desta abordagem é que você aceita servir dados potencialmente obsoletos em troca de não bloquear o request. Para feeds de posts, contagens e dados analíticos isso é aceitável. Para saldo bancário ou estoque em tempo real, não.

## O que acontece quando nenhuma dessas proteções está no lugar

Se você tem uma aplicação sem nenhuma dessas proteções e o cache de uma chave popular expira, o sinal típico no monitoramento é: pico abrupto de latência nas queries do PostgreSQL, seguido de timeout de conexões, seguido de cascade failure para outras queries que dependem do mesmo pool de conexões.

A causa raiz parece ser "banco lento", mas na verdade o banco está recebendo tráfego que o cache deveria absorver. O diagnóstico é difícil porque o problema se autocorrige quando o cache esquenta — fazendo parecer um pico aleatório de latência.

## O que escolher

Lock distribuído é mais simples de entender e debugar, mas adiciona latência de espera para requests concorrentes. É a escolha certa quando a consistência importa mais do que latência.

Probabilistic early reexpiration elimina a espera — cada request decide individualmente se revalida. É bom para dados com custo de geração previsível e tráfego constante.

Stale-while-revalidate é o mais tolerante, mas exige que o domínio aceite dados ligeiramente desatualizados. Funciona bem para conteúdo editorial e feeds.

Nenhuma das três é universal. O contexto — criticidade do dado, latência aceitável, custo de revalidação — é que determina o que faz sentido usar.

## Como detectar um cache stampede em produção

O sinal de um cache stampede raramente aparece como "cache stampede" no monitoramento. O que você vê é latência de banco subindo abruptamente, sem aumento correspondente no tráfego total. O pool de conexões do PostgreSQL sendo esgotado. O Redis respondendo normalmente — cache miss não é erro, é dado ausente.

\`\`\`bash
# Redis: monitorar proporção de hits e misses
redis-cli INFO stats | grep -E "keyspace_hits|keyspace_misses"

# Taxa de miss disparando com pico de queries no banco = sinal de stampede
\`\`\`

Outra forma de detectar: instrumentar o número de \`GET\` seguidos de \`SET\` na mesma chave em um intervalo curto. Se dez workers fizeram \`GET → banco → SET\` na mesma chave em 200ms, você teve um stampede pequeno. Em escala, esse padrão aparece como queries idênticas em paralelo no pg_stat_activity.

O desafio de diagnóstico é que o problema se autocorrige quando o cache esquenta. Sem instrumentação específica, o stampede parece um pico aleatório de latência que "sumiu sozinho" — até acontecer de novo no próximo TTL.

## Conclusão

Cache stampede é um exemplo de falha que emerge de componentes funcionando exatamente como esperado. O Redis está saudável. O PostgreSQL está funcionando. As queries estão corretas. E ainda assim o sistema fica instável sob tráfego.

A causa é uma suposição implícita na maioria das implementações de cache: que expiração e ausência de chave são eventos raros. Sob tráfego alto, essa suposição falha de forma previsível — especialmente em chaves populares com TTL fixo, onde todo mundo que cacheou ao mesmo tempo também expira ao mesmo tempo.

A proteção não precisa ser complexa. Lock distribuído resolve a maioria dos casos com código simples. Stale-while-revalidate é suficiente para conteúdo editorial. Probabilistic early reexpiration tem valor quando queries lentas representam risco especialmente alto de stampede.

O que não é opcional é reconhecer que cache expiration sob carga é um ponto de falha real, não teórico. A decisão sobre qual estratégia usar pode ser contextual. A decisão de não ter nenhuma estratégia é um risco silencioso esperando o TTL certo para se manifestar.`,
  status: 'published' as const,
  order: 3,
  publishedAt: new Date('2026-05-16T12:00:00.000Z'),
  tagSlugs: ['cache-stampede', 'redis', 'postgresql', 'architecture', 'system-design'],
};
