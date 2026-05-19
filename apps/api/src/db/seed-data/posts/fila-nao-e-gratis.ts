export const FILA_NAO_E_GRATIS_POST = {
  slug: 'fila-nao-e-gratis',
  coverImage: 'posts/fila-troca.png',
  title: 'Fila não é solução mágica — é troca',
  excerpt:
    'Fila compra desacoplamento e resiliência, mas cobra em estado distribuído, observabilidade e teste de fluxo completo.',
  content: `## O que você compra com uma fila

Adicionar uma fila entre dois componentes compra coisas reais: desacoplamento temporal (o produtor não precisa esperar o consumidor), resiliência (se o consumidor cai, as mensagens ficam na fila), absorção de pico (você nivela a pressão em vez de absorver tudo de uma vez).

Esses benefícios são genuínos. Mas cada um tem um custo correspondente que frequentemente não aparece na discussão inicial.

O desacoplamento temporal compra latência eventual. A resiliência compra estado distribuído. A absorção de pico compra complexidade operacional. Você não elimina o custo — você muda onde ele ocorre.

## Estado distribuído é o custo mais subestimado

Quando você coloca uma operação numa fila, o estado daquela operação existe em dois lugares: no produtor (que enviou) e no broker (que vai entregar). Antes, existia só em um lugar.

Isso cria perguntas que antes não existiam.

**O que acontece se o job falha?** Você precisa de uma política de retry. Com quantas tentativas? Com qual backoff? O que vai para a DLQ (dead letter queue) quando as tentativas esgotam?

**O que acontece se o job é processado duas vezes?** Redes falham, acks se perdem. O worker pode receber a mesma mensagem mais de uma vez. Sua lógica precisa ser **idempotente** — processar o mesmo job duas vezes deve ter o mesmo efeito que processar uma vez.

\`\`\`typescript
// Não idempotente: segunda execução cria registro duplicado
async function processPayment(data: PaymentJobData) {
  await db.payments.create({
    userId: data.userId,
    amount: data.amount,
    processedAt: new Date(),
  });
}

// Idempotente: segunda execução é no-op se o pagamento já existe
async function processPayment(data: PaymentJobData) {
  await db.payments.upsert({
    where: { idempotencyKey: data.idempotencyKey },
    create: {
      userId: data.userId,
      amount: data.amount,
      processedAt: new Date(),
      idempotencyKey: data.idempotencyKey,
    },
    update: {}, // já existe, não atualiza nada
  });
}
\`\`\`

A chave de idempotência precisa vir do produtor — não pode ser gerada no worker, porque cada execução geraria uma chave diferente.

## Observabilidade deixa de ser opcional

Com processamento síncrono, o request termina com um status code. O usuário vê o resultado. Se falhou, o log tem o stack trace.

Com fila, o processamento acontece assincronamente. O log do worker está em outro processo, potencialmente em outro container.

Isso cria três problemas práticos.

**Correlação**: como você relaciona um request HTTP com o job que ele enfileirou? Sem um \`correlationId\` ou \`traceId\` propagado do request para o job, você tem logs desconectados.

**Visibilidade de estado**: o usuário pergunta "meu pagamento foi processado?". A resposta requer uma query no banco que o worker popula. Você precisa de uma tabela de estado que o frontend possa consultar.

**Alertas em jobs mortos**: se um job vai para a DLQ, alguém precisa saber. DLQ sem alertas é um buraco negro — jobs críticos morrem silenciosamente.

\`\`\`typescript
// BullMQ: escuta falhas e alimenta observabilidade
worker.on('failed', (job, err) => {
  logger.error('Job failed', {
    jobId: job?.id,
    jobName: job?.name,
    attempt: job?.attemptsMade,
    correlationId: job?.data.correlationId,
    error: err.message,
  });
});
\`\`\`

## Testar o fluxo completo é mais difícil

Testar um endpoint síncrono é direto: você chama, você verifica o resultado. Testar um fluxo com fila envolve verificar que o job foi enfileirado, que o worker processou, que o estado final está correto.

Em testes de integração, as opções são:

**Processar sincronamente em teste**: configurar o worker para processar imediatamente, no mesmo processo. Funciona, mas esconde timing issues e comportamento de retry real.

**Mockar o enqueue**: verificar que o job foi enfileirado com os dados corretos, sem processar. Simples, mas não testa o worker em si.

**Testes end-to-end com worker real**: o mais fiel ao comportamento de produção, mas requer infraestrutura completa e é mais lento.

O que importa é ter pelo menos testes unitários para a função de processamento do worker e testes de integração para o contrato do job — que o produtor enfileira com os dados corretos.

## O padrão outbox resolve entrega garantida

Há um problema sutil com \`enqueue\` direto: e se o banco falhar entre o \`INSERT\` da transação principal e o \`enqueue\` na fila? A transação commitou, mas o job não foi enfileirado. O evento se perdeu.

O outbox pattern resolve isso:

\`\`\`typescript
// Dentro de uma única transação de banco:
await db.transaction(async (tx) => {
  // 1. Aplica a mudança de negócio
  await tx.orders.create({ userId, items });

  // 2. Registra o evento a ser processado (no banco, não na fila)
  await tx.outbox.create({
    eventType: 'order.created',
    payload: { userId, items },
    status: 'pending',
  });
  // Commit atômico: ou ambos acontecem, ou nenhum
});

// Worker relay separado lê o outbox e enfileira — ou processa diretamente
\`\`\`

O custo é a complexidade do relay e a latência adicional — o evento só é processado quando o relay lê a linha. O benefício é garantia de entrega sem duplicações acidentais por race condition entre transação e enqueue.

## Quando a fila faz sentido

Fila faz sentido quando o processamento é genuinamente assíncrono do ponto de vista do usuário: envio de email, geração de relatório, sincronização com sistema externo. O usuário não precisa esperar pelo resultado, e o backend não quer pagar o custo de latência imediata.

Fila não faz sentido quando o usuário precisa do resultado no mesmo request. Nesse caso você está adicionando latência e complexidade sem benefício real.

Fila não faz sentido como solução para "o endpoint está lento". A fila esconde a latência, não a elimina. O processamento ainda acontece — só acontece em outro lugar. Se o problema é a query lenta, a fila compra tempo mas o custo real permanece.

A pergunta correta antes de introduzir uma fila não é "como adiciono isso à fila?". É "o processamento precisa ser assíncrono? Qual é o custo de fazê-lo síncrono?". Se a resposta for "sim, o custo síncrono é real", aí a fila se justifica — com todos os custos operacionais que ela traz junto.

## Saúde operacional de uma fila em produção

Uma fila sem monitoramento adequado é um risco oculto. Os problemas aparecem de forma silenciosa: jobs que morrem na DLQ sem alerta, backlog crescendo sem aviso, processamento que parou sem notificação.

As métricas essenciais para operar uma fila com segurança:

**Profundidade** — número de jobs aguardando processamento. Uma fila crescendo sem ser consumida é sinal de worker com problema ou capacidade insuficiente para o throughput atual.

**Taxa de falha e tamanho da DLQ** — quantos jobs estão falhando e quantos chegaram à dead letter queue. DLQ sem alertas é onde processamentos críticos desaparecem silenciosamente. É o equivalente de swallow silencioso no nível de infraestrutura.

**Latência de processamento** — tempo entre o enqueue e a conclusão. Para fluxos onde o usuário aguarda feedback (mesmo assincronamente, via polling ou webhook), essa métrica define a experiência percebida.

**Staleness** — jobs enfileirados há muito mais tempo do que o esperado. Pode indicar worker parado, backlog permanente, ou job preso em retry loop com backoff longo.

\`\`\`typescript
// BullMQ: métricas disponíveis para integrar com qualquer stack de observabilidade
const counts = await queue.getJobCounts(
  'waiting', 'active', 'completed', 'failed', 'delayed'
);

// Exponha para Prometheus, DataDog, ou CloudWatch
worker.on('failed', (job, err) => {
  logger.error('Job failed', {
    jobId: job?.id,
    jobName: job?.name,
    attempt: job?.attemptsMade,
    maxAttempts: job?.opts.attempts,
    correlationId: job?.data.correlationId,
    error: err.message,
  });
  metrics.increment('queue.job.failed', { queue: queue.name, job: job?.name });
});
\`\`\`

## Conclusão

A fila resolve problemas reais — desacoplamento temporal, resiliência a falhas, absorção de pico de carga. Mas cada benefício carrega um custo correspondente que só aparece depois de colocar em produção: estado distribuído que precisa de idempotência, observabilidade que deixa de ser opcional, testes que verificam produtor, worker e estado final em separado.

O estado distribuído é o custo mais insidioso. Jobs que falham silenciosamente. Mensagens processadas duas vezes por ack perdido. Eventos que se perdem entre a transação e o enqueue. Cada um desses problemas tem solução — mas cada solução adiciona superfície de código e infraestrutura que precisa de manutenção.

A decisão de usar uma fila não é técnica — é arquitetural. Você está decidindo que processamento assíncrono vale a complexidade que vem junto. Essa decisão é muito mais fácil de tomar do que de desfazer: uma vez que o modelo mental do produto assume assincronicidade, reverter para síncrono exige mudar mais do que o código.

Use fila quando o problema é genuinamente assíncrono. Trate a observabilidade, a idempotência e os testes de fluxo completo como parte do custo, não como melhorias futuras. E quando estiver em dúvida, meça o custo de fazer síncrono antes de assumir que a fila é a resposta certa.`,
  status: 'published' as const,
  order: 6,
  publishedAt: new Date('2026-05-13T12:00:00.000Z'),
  tagSlugs: [
    'queues',
    'message-queue',
    'bullmq',
    'redis',
    'architecture',
    'backend',
    'observabilidade',
    'idempotencia',
    'padrao-outbox',
  ],
};
