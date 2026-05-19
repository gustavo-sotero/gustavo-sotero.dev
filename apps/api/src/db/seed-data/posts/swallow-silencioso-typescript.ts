export const SWALLOW_SILENCIOSO_TYPESCRIPT_POST = {
  slug: 'swallow-silencioso-typescript',
  coverImage: 'posts/try-catch.png',
  title: 'try/catch não trata erro — esconde',
  excerpt:
    'O problema não é usar try/catch; é capturar erro e devolver null como se falha fosse um detalhe irrelevante.',
  content: `## O try/catch que finge que nada aconteceu

\`\`\`typescript
async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    return await db.users.findById(userId);
  } catch {
    return null;
  }
}
\`\`\`

Esse padrão aparece em codebases inteiros. Às vezes com \`catch (e)\` sem usar \`e\`. Às vezes com um \`console.log(e)\` que ninguém monitora. Às vezes com um comentário "// can't happen".

O problema não é o \`try/catch\`. O problema é o que acontece no \`catch\`: o erro é swallowed — engolido — e o chamador recebe \`null\` como se a operação tivesse simplesmente não encontrado resultado.

O chamador não sabe se o banco está offline, se o userId é inválido, se houve timeout, ou se o usuário genuinamente não existe. Para o chamador, tudo parece igual.

## Por que null é a pior resposta para um erro

\`null\` como resultado de erro tem um problema estrutural: ele não carrega nenhuma informação sobre o que falhou.

O chamador precisa escolher entre dois caminhos ruins:

\`\`\`typescript
const profile = await getUserProfile('user-123');
if (!profile) {
  // Banco offline? Usuário não existe? Timeout? Query inválida?
  // Não há como saber. O erro foi perdido no catch acima.
  return notFound();
}
\`\`\`

Isso cria uma cadeia de \`null\` propagando pela aplicação. Cada função que chama outra que pode retornar \`null\` precisa verificar e tratar, sem ter informação real do que aconteceu.

Em produção, quando o banco está offline, você vê \`404 Not Found\` em vez de \`503 Service Unavailable\`. O monitoramento reporta "usuário não encontrado" quando na verdade é uma falha de infraestrutura.

## A distinção que importa: ausência versus falha

Há dois cenários semanticamente diferentes que costumam ser tratados da mesma forma:

1. **Ausência legítima**: o recurso não existe e isso é esperado
2. **Falha**: algo impediu a operação de completar

Um retorno \`null\` pode expressar (1). Nunca deve expressar (2).

\`\`\`typescript
// Correto: retorna null para ausência legítima
async function findUserById(id: string): Promise<User | null> {
  const rows = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] ?? null;
}

// Errado: swallows a falha e transforma em ausência
async function findUserById(id: string): Promise<User | null> {
  try {
    const rows = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] ?? null;
  } catch {
    return null; // ← apaga a distinção entre "não existe" e "algo quebrou"
  }
}
\`\`\`

## Como erros deveriam se propagar

A regra geral é: **deixe o erro subir até quem pode tratá-lo com contexto suficiente**.

Se \`getUserProfile\` falha porque o banco está offline, quem tem contexto para decidir o que fazer é a camada de rota HTTP — que pode retornar 503 com retry-after, logar o erro com o request-id, e não tratar como ausência de recurso.

\`\`\`typescript
// Função que pode lançar — não tenta esconder falhas de infraestrutura
async function getUserProfile(userId: string): Promise<UserProfile> {
  const user = await db.users.findById(userId);
  if (!user) throw new NotFoundError(\`User \${userId} not found\`);
  return user;
}

// Camada de rota trata cada caso com contexto correto
router.get('/users/:id', async (c) => {
  try {
    const profile = await getUserProfile(c.req.param('id'));
    return c.json(profile);
  } catch (err) {
    if (err instanceof NotFoundError) return c.json({ error: err.message }, 404);
    // Falhas desconhecidas sobem — middleware global loga e retorna 500
    throw err;
  }
});
\`\`\`

## Quando catch + null é legítimo

Existe um caso onde capturar e retornar \`null\` faz sentido: quando você está integrando com uma biblioteca ou SDK externo que usa exceções para indicar ausência, e você quer normalizar para o padrão do seu código.

\`\`\`typescript
// Integrando com SDK que lança exceção para "não encontrado"
async function getExternalUser(externalId: string): Promise<ExternalUser | null> {
  try {
    return await externalSdk.getUser(externalId);
  } catch (err) {
    if (err instanceof ExternalSdk.NotFoundError) return null;
    throw err; // qualquer outro erro propaga normalmente
  }
}
\`\`\`

A diferença crítica: você captura **apenas a exceção específica** que significa ausência, e relança tudo o mais. O \`catch\` genérico sem tipo é o problema — ele trata timeout, erro de rede, e bug interno da mesma forma que "não encontrado".

## Typed errors como contrato explícito

TypeScript não força tipagem em erros capturados por padrão — o tipo de \`err\` em um \`catch\` é \`unknown\`. Isso é deliberado: o compilador não sabe o que pode ser lançado.

O que isso viabiliza: criar tipos de erro explícitos e verificar antes de tratar.

\`\`\`typescript
class DatabaseError extends Error {
  constructor(
    public readonly code: 'connection' | 'timeout' | 'constraint',
    message: string
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

class NotFoundError extends Error {
  constructor(public readonly resource: string) {
    super(\`\${resource} not found\`);
    this.name = 'NotFoundError';
  }
}

async function findUser(id: string): Promise<User | null> {
  try {
    const result = await db.users.findById(id);
    return result ?? null;
  } catch (err) {
    if (err instanceof DatabaseError && err.code === 'connection') {
      throw err; // propaga falha de infraestrutura
    }
    if (err instanceof DatabaseError && err.code === 'constraint') {
      return null; // ID com formato inválido, trata como não-encontrado
    }
    throw err; // qualquer coisa desconhecida propaga
  }
}
\`\`\`

## O custo real do swallow silencioso

O swallow silencioso não falha de forma visível. Ele falha de forma silenciosa e intermitente, o que é pior.

O banco fica instável às 2 da manhã. Os logs mostram zero erros porque todos foram engolidos. O monitoramento reporta 200 OKs. Os usuários veem respostas vazias. O time acorda com um relatório de "o sistema estava retornando resultados estranhos" — sem stack trace, sem log de erro, sem nenhum sinal direto do que aconteceu.

Erros existem para ser observados. Quando você os engole, você remove o sinal que permitiria diagnosticar o problema. O \`try/catch\` não é o culpado — é o que acontece dentro dele.

## O padrão Result como alternativa explícita

Uma alternativa ao throw/catch para falhas esperadas é o tipo \`Result\` — uma estrutura que torna a possibilidade de falha parte da assinatura da função, não um efeito colateral invisível.

\`\`\`typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

async function findUser(id: string): Promise<Result<User, 'not_found' | 'db_error'>> {
  try {
    const user = await db.users.findById(id);
    if (!user) return { ok: false, error: 'not_found' };
    return { ok: true, value: user };
  } catch (err) {
    if (err instanceof DatabaseError && err.code === 'connection') {
      return { ok: false, error: 'db_error' };
    }
    throw err; // erros inesperados ainda propagam
  }
}

// O chamador é forçado pelo TypeScript a verificar o resultado
const result = await findUser('user-123');
if (!result.ok) {
  if (result.error === 'not_found') return c.json({ error: 'User not found' }, 404);
  if (result.error === 'db_error') return c.json({ error: 'Service unavailable' }, 503);
}

// TypeScript sabe que result.value é User aqui — sem asserção necessária
const profile = buildProfile(result.value);
\`\`\`

A vantagem principal é que o TypeScript garante em compile time que o chamador verificou o resultado antes de acessar o valor. A desvantagem é verbosidade adicional e o fato de que erros inesperados — bugs de programação, erros de infraestrutura imprevistos — ainda precisam de throw.

A escolha entre throw e \`Result\` não é dogmática. Use throw para erros de infraestrutura que devem propagar até um handler global. Use \`Result\` para falhas de negócio onde o chamador tem contexto para agir de forma específica e diferenciada. Os dois coexistem no mesmo codebase sem contradição.

## Conclusão

O \`try/catch\` que silencia erros não é um padrão de tratamento de erro — é um padrão de ocultação de falha. A distinção importa porque o objetivo do tratamento de erros é duplo: proteger o usuário de comportamento inesperado e preservar o sinal que permite diagnosticar o que aconteceu. Quando você engole um erro com \`catch { return null }\`, você cumpre o primeiro objetivo parcialmente e falha completamente no segundo.

O resultado em produção é um sistema que parece funcionar quando está falhando silenciosamente. Usuários veem respostas vazias. O monitoramento reporta 200 OK. Os logs não têm stack trace. Quando o incidente escala, não existe trilha de diagnóstico porque o erro foi destruído onde ocorreu.

Erros são sinais. Tratá-los corretamente significa decidir conscientemente onde o sinal é observado, como é propagado, e quem tem contexto suficiente para agir. Um \`catch\` genérico que descarta o erro é uma decisão de destruir esse sinal antes que qualquer um possa usá-lo — e essa decisão se paga com horas de depuração no pior momento possível.`,
  status: 'published' as const,
  order: 5,
  publishedAt: new Date('2026-05-14T12:00:00.000Z'),
  tagSlugs: ['typescript', 'error-handling', 'backend', 'clean-code', 'observabilidade'],
};
