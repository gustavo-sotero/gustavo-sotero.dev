export const ALGEBRA_BOOLEANA_REGRAS_DE_NEGOCIO_POST = {
  slug: 'algebra-booleana-regras-de-negocio',
  coverImage: 'posts/logica.png',
  title: 'Álgebra booleana em regras de negócio',
  excerpt:
    'Condições nomeadas e leis de De Morgan ajudam a transformar ifs frágeis em regras que QA, PM e dev conseguem validar.',
  content: `## O problema com if aninhado

Regras de negócio tendem a crescer. O que começa como um if limpo vira uma hierarquia de condições que ninguém consegue raciocinar sem executar mentalmente.

\`\`\`typescript
if (user.plan === 'pro' || user.plan === 'enterprise') {
  if (!user.trialExpired || user.billingActive) {
    if (feature.enabled && !feature.betaOnly || user.isBetaTester) {
      // acesso permitido
    }
  }
}
\`\`\`

O problema aqui não é a linguagem nem o framework. É que a lógica não tem nome. As condições são código, mas a regra de negócio está implícita na estrutura do if.

## Condições nomeadas como linguagem compartilhada

A primeira técnica que resolve isso é simples: dar nome a cada condição relevante.

\`\`\`typescript
const isPaidPlan = user.plan === 'pro' || user.plan === 'enterprise';
const hasActiveAccess = !user.trialExpired || user.billingActive;
const canAccessFeature = feature.enabled && (!feature.betaOnly || user.isBetaTester);

if (isPaidPlan && hasActiveAccess && canAccessFeature) {
  // acesso permitido
}
\`\`\`

Isso já é uma melhora. Mas ainda não é explícito o suficiente para que um QA ou PM consiga ler e validar sem contexto técnico.

O passo seguinte é elevar a abstração: nomear a **decisão**, não apenas as condições individuais.

\`\`\`typescript
function canAccessPremiumFeature(user: User, feature: Feature): boolean {
  const isPaidPlan = user.plan === 'pro' || user.plan === 'enterprise';
  const hasActiveAccess = !user.trialExpired || user.billingActive;
  const isFeatureAvailable = feature.enabled && (!feature.betaOnly || user.isBetaTester);

  return isPaidPlan && hasActiveAccess && isFeatureAvailable;
}
\`\`\`

Agora o teste de QA pode ser escrito direto: "usuário pro com trial expirado e billing ativo deve ter acesso". O critério está no código.

## De Morgan na prática

As leis de De Morgan são frequentemente ignoradas no código do dia a dia, mas têm impacto direto na legibilidade de condições negadas.

A lei diz:
- \`!(A && B)\` é equivalente a \`!A || !B\`
- \`!(A || B)\` é equivalente a \`!A && !B\`

Na prática:

\`\`\`typescript
// Difícil de raciocinar: negação de uma conjunção
if (!(user.isActive && user.hasConfirmedEmail)) {
  return unauthorized();
}

// Mais legível com De Morgan aplicado
if (!user.isActive || !user.hasConfirmedEmail) {
  return unauthorized();
}
\`\`\`

A versão com De Morgan deixa explícito o que causa o bloqueio: qualquer uma das duas condições é suficiente para negar o acesso. Sem a lei aplicada, você precisa mentalmente distribuir a negação.

Outro exemplo comum, com guard clause:

\`\`\`typescript
// Sem De Morgan
if (!(order.status === 'pending' || order.status === 'processing')) {
  throw new Error('Order is not cancellable');
}

// Com De Morgan
if (order.status !== 'pending' && order.status !== 'processing') {
  throw new Error('Order is not cancellable');
}
\`\`\`

## Quando extrair para um objeto de política

Quando as regras de negócio crescem além de uma função, a estrutura que resolve melhor é um objeto de política explícito.

\`\`\`typescript
const accessPolicy = {
  isPaidPlan(user: User): boolean {
    return user.plan === 'pro' || user.plan === 'enterprise';
  },
  hasActiveAccess(user: User): boolean {
    return !user.trialExpired || user.billingActive;
  },
  isFeatureAvailable(feature: Feature, user: User): boolean {
    return feature.enabled && (!feature.betaOnly || user.isBetaTester);
  },
  canAccess(user: User, feature: Feature): boolean {
    return (
      this.isPaidPlan(user) &&
      this.hasActiveAccess(user) &&
      this.isFeatureAvailable(feature, user)
    );
  },
};
\`\`\`

Isso tem duas vantagens concretas: cada regra pode ser testada em isolamento sem montar o objeto de usuário completo, e quando a regra de negócio muda, você sabe exatamente onde está.

## O teste que valida a regra, não a implementação

A consequência direta de nomear condições é que os testes ficam mais fáceis de escrever e mais fáceis de ler.

\`\`\`typescript
describe('accessPolicy', () => {
  it('bloqueia usuário free mesmo com billing ativo', () => {
    expect(accessPolicy.isPaidPlan({ plan: 'free' } as User)).toBe(false);
  });

  it('permite acesso a usuário enterprise com trial expirado se billing está ativo', () => {
    const user = { plan: 'enterprise', trialExpired: true, billingActive: true } as User;
    expect(accessPolicy.hasActiveAccess(user)).toBe(true);
  });

  it('bloqueia feature beta para não-beta-tester mesmo com feature habilitada', () => {
    const feature = { enabled: true, betaOnly: true } as Feature;
    const user = { isBetaTester: false } as User;
    expect(accessPolicy.isFeatureAvailable(feature, user)).toBe(false);
  });
});
\`\`\`

Cada teste cobre uma regra de negócio específica. Quando o PM muda a definição de "acesso ativo", você sabe qual teste atualizar e qual parte do código modificar.

## O limite da abstração

Nomear condições não é uma regra absoluta. Extrair cada expressão booleana para uma função separada adiciona indireção desnecessária quando a condição é simples e de uso único.

\`\`\`typescript
// Desnecessário: condição puramente técnica, sem semântica de negócio
const isString = typeof value === 'string';
if (isString) { ... }

// Direto é melhor
if (typeof value === 'string') { ... }
\`\`\`

A heurística que funciona: nomeie quando a condição tem **semântica de negócio** — quando o nome diz algo que não está óbvio nos operadores — ou quando ela é **reutilizada em múltiplos lugares**.

Condições puramente técnicas e de uso único não precisam de nome. A linha entre os dois é julgamento, não regra mecânica.

## Especificação booleana como composição de regras

Quando regras de negócio crescem além de um objeto de política e precisam ser combinadas dinamicamente, o padrão Specification faz essa estrutura explícita: cada regra vira um objeto com método \`isSatisfiedBy\`, que pode ser composto com \`and\`, \`or\`, \`not\`.

\`\`\`typescript
interface Specification<T> {
  isSatisfiedBy(entity: T): boolean;
  and(other: Specification<T>): Specification<T>;
  or(other: Specification<T>): Specification<T>;
  not(): Specification<T>;
}

class PaidPlanSpec implements Specification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.plan === 'pro' || user.plan === 'enterprise';
  }
  and(other: Specification<User>) { return new AndSpec(this, other); }
  or(other: Specification<User>) { return new OrSpec(this, other); }
  not() { return new NotSpec(this); }
}

// Composição legível sem if aninhado
const canAccess = new PaidPlanSpec()
  .and(new ActiveAccessSpec())
  .and(new FeatureAvailableSpec(feature));

if (canAccess.isSatisfiedBy(user)) {
  // acesso permitido
}
\`\`\`

Para regras fixas definidas em tempo de compilação, um objeto de política com métodos nomeados é mais legível sem a infraestrutura extra. Specification faz sentido quando as combinações precisam ser montadas em tempo de execução — por configuração, por perfil de usuário, por conjunto de permissões que varia.

## Conclusão

O problema central com condições booleanas não é de sintaxe — é de semântica escondida. Um \`if\` com seis operadores booleanos pode estar correto e ainda assim ser impossível de raciocinar sem executar mentalmente. A pergunta que transforma condições frágeis em regras sustentáveis é simples: **alguém que não escreveu esse código consegue ler e dizer o que ele verifica?**

Dar nome a condições com semântica de negócio, aplicar De Morgan para eliminar negações compostas, extrair políticas quando as regras crescem — cada uma dessas práticas serve ao mesmo objetivo: tornar o código a fonte de verdade sobre o comportamento esperado, não só uma implementação técnica que precisa de tradução.

Isso tem efeito direto fora da engenharia. Quando um QA consegue ler \`canAccessPremiumFeature\` e escrever casos de teste sem precisar de explicação, você reduziu o atrito entre a especificação de negócio e o código que a implementa. Quando uma regra muda e você sabe exatamente qual função alterar e qual teste atualizar, você tem um codebase que resiste à evolução de requisitos sem acumular ambiguidade.

Álgebra booleana bem aplicada não é sobre elegância. É sobre criar código que verifica a si mesmo — onde o leitor consegue confrontar a implementação com o requisito sem tradução adicional.`,
  status: 'published' as const,
  order: 2,
  publishedAt: new Date('2026-05-17T12:00:00.000Z'),
  tagSlugs: ['boolean-algebra', 'business-rules', 'clean-code', 'typescript'],
};
