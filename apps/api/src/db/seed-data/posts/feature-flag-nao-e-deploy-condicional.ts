export const FEATURE_FLAG_NAO_E_DEPLOY_CONDICIONAL_POST = {
  slug: 'feature-flag-nao-e-deploy-condicional',
  coverImage: 'posts/feature-flag.png',
  title: 'Feature flag não é deploy condicional',
  excerpt:
    'Feature flag não serve só para liberar aos poucos; o valor real é desligar algo em segundos quando produção pede socorro.',
  content: `## A confusão mais comum sobre feature flags

A maioria dos times trata feature flag como uma forma glorificada de deploy condicional. Você lança uma funcionalidade, coloca um \`if (flag)\` na frente, ativa para 10% dos usuários, expande para 100%, deleta a flag. Processo limpo, controle granular.

Isso não é errado. Mas é incompleto.

O valor real de uma feature flag não está no rollout gradual. Está no kill switch — na capacidade de desligar algo em segundos, sem deployar, sem acordar o time às 3 da manhã, sem rollback de banco.

## O que um rollout gradual realmente te dá

Rollout percentual é útil por uma razão específica: permite observar comportamento sob carga real antes de expor para todo mundo. Latência de query, uso de memória, taxa de erro — você vê isso em produção com impacto controlado.

Mas o rollout termina. Você chega em 100%, decide que a funcionalidade está estável, e o que acontece com a flag?

Se a resposta for "a gente apaga depois", você está acumulando débito. Flags sem data de revisão definida viram configuração permanente. E configuração permanente que ninguém consegue rastrear é complexidade acidental.

## O kill switch que justifica o investimento

Pensa no cenário oposto: você lançou algo, está em 100%, e três dias depois aparece um comportamento inesperado em produção — não necessariamente um bug, mas uma interação com dados reais que o QA não cobriu.

Sem flag, suas opções são: fazer rollback de deploy (lento, arriscado se houver migração de banco acoplada), colocar um hotfix no ar (pressão, risco de introduzir outro bug), ou conviver com o problema enquanto investiga.

Com flag, você desliga em 10 segundos. O problema para de se propagar. O time respira. A investigação acontece sem pressão de incidente ativo.

Essa é a proposta central das feature flags: **separar o deploy do lançamento, e separar o lançamento do comportamento em produção**.

## Quando o custo se justifica

Flags não são gratuitas. Elas adicionam branches de código, dificultam leitura se mal gerenciadas, e criam estado que precisa ser limpo.

Vale o custo quando a funcionalidade tem risco não-trivial de comportamento em produção — não por falta de teste, mas porque dados reais são complexos e imprevisíveis. Vale quando a operação de desfazer é cara: se o rollback implica migração reversa de banco ou reprocessamento de mensagens, o custo de uma flag é negligenciável. Vale quando o lançamento precisa ser coordenado com algo externo — marketing, release note, anúncio para cliente — situações onde o código já precisa estar em produção mas o comportamento ainda não deve ser visível.

## Como evitar o débito de flags acumulado

O maior problema das feature flags em times maduros não é criar, é nunca limpar.

Flags que deveriam ser temporárias se tornam permanentes porque ninguém quer tocar em código que "está funcionando". Você acaba com uma base cheia de \`if (featureX)\` onde metade das flags está sempre ativa e a outra metade ninguém sabe.

A prática que funciona: **toda flag tem uma data de revisão no momento em que é criada**. Não expiração automática — isso cria outros problemas — mas um item no backlog com a pergunta "essa flag ainda faz sentido?".

\`\`\`typescript
// Ruim: flag sem contexto e sem rastreabilidade
if (featureFlags.get('new-checkout')) {
  return newCheckout(cart);
}
return legacyCheckout(cart);

// Melhor: flag nomeada com intenção clara e revisão agendada
const isNewCheckoutEnabled = await flags.isEnabled('new-checkout', { userId });
// Revisão agendada: "new-checkout vai para 100% até 2026-06-01 ou ser removida"
if (isNewCheckoutEnabled) {
  return newCheckout(cart);
}
return legacyCheckout(cart);
\`\`\`

## O que flags não resolvem

Flag não substitui teste. Se o comportamento em produção é imprevisível porque não existe teste de contrato, a flag é um band-aid.

Flag não substitui observabilidade. Você só consegue decidir com segurança se tem métricas mostrando o impacto. Sem dashboards e alertas, a flag é decoração.

Flag não elimina o débito técnico do código antigo. A funcionalidade antiga, protegida pela flag "desligada", ainda existe no repositório, ainda precisa ser entendida, ainda pode introduzir conflito em merges.

O kill switch só tem valor quando você sabe o que está acontecendo o suficiente para apertar o botão. Isso requer observabilidade, não só flags.

## A distinção que importa

Deploy condicional é um detalhe de implementação. Feature flag é uma decisão de produto e operação.

Quando você separa o ato de fazer deploy do ato de ligar uma funcionalidade, você ganha algo além de controle técnico: ganha vocabulário compartilhado com PM, com QA, com o time de operações. Todo mundo entende o que "desligar a flag" significa — sem precisar de um engenheiro explicando o processo de rollback.

Essa clareza operacional é frequentemente mais valiosa do que o rollout percentual.

## Ciclos de vida diferentes pedem gestão diferente

Nem toda flag é igual. Martin Fowler categoriza feature flags em quatro tipos por ciclo de vida, e a distinção importa para decidir quando limpar.

**Release toggles** existem durante o desenvolvimento de uma funcionalidade. Permitem que código incompleto viva no branch principal sem afetar produção. São de curta duração por natureza: quando a funcionalidade está pronta, a flag vai embora em dias ou semanas.

**Experiment toggles** controlam testes A/B e experimentos com usuários. Duram enquanto o experimento está ativo e precisam de infraestrutura de analytics para ter valor — a flag sem a coleta de dados é só complexidade.

**Ops toggles** são os kill switches. Podem ser permanentes por design, especialmente em sistemas críticos onde a capacidade de desligar algo em segundos tem valor operacional contínuo. Um circuit breaker para integração com gateway de pagamento externo pode viver indefinidamente.

**Permission toggles** controlam acesso por perfil: beta testers, plano premium, early adopters. São os mais propensos a se tornarem permanentes sem planejamento — porque deixam de ser flags de engenharia e viram configuração de produto.

O critério de limpeza é diferente para cada tipo. Uma release toggle tem prazo de semanas. Uma ops toggle pode ser justificada permanentemente. Uma permission toggle pertence ao modelo de dados do produto, não ao código de deploy. Misturar esses ciclos numa mesma estratégia de gestão é o que cria bases com dezenas de flags sem dono.

## Conclusão

Feature flag é uma ferramenta de gestão de risco operacional, não um mecanismo de deploy incremental. O rollout gradual tem valor real — mas é o benefício secundário. O que justifica o investimento em infraestrutura de flags é a separação entre o momento em que o código chega à produção e o momento em que o comportamento está ativo para o usuário.

Essa separação cria uma camada de controle que não existe com deploy tradicional. O kill switch transforma um incidente de madrugada numa operação de 10 segundos. A coordenação com marketing vira um campo booleano em vez de uma reunião de sincronismo. A validação em dados reais acontece sem pressão de exposição total.

O custo é real: código adicional, estado que precisa de limpeza, indireção que dificulta leitura. Flags acumuladas sem critério de expiração são débito técnico da pior espécie — invisível, distribuído e sem dono aparente.

A prática que sustenta isso a longo prazo não é técnica: toda flag tem um ciclo de vida decidido no momento em que é criada. Release toggle com prazo de revisão. Ops toggle com dono identificado. Permission toggle que faz parte do modelo do produto. Sem essa disciplina, o custo cresce sem perceber. Com ela, feature flag cumpre o que promete: separar deploy de consequência — e essa separação vale o trabalho.`,
  status: 'published' as const,
  order: 1,
  publishedAt: new Date('2026-05-18T12:00:00.000Z'),
  tagSlugs: [
    'feature-flags',
    'continuous-delivery',
    'rollback',
    'technical-debt',
    'observabilidade',
  ],
};
