export const IEEE_754_SISTEMAS_FINANCEIROS_POST = {
  slug: 'ieee-754-sistemas-financeiros',
  coverImage: 'posts/ieee-754.png',
  title: '0.1 + 0.2 ≠ 0.3 — por que dinheiro não deve ser float',
  excerpt:
    '0.1 + 0.2 não é bug da linguagem; é sinal de que dinheiro não deveria ser modelado com float padrão.',
  content: `## 0.1 + 0.2 ≠ 0.3

\`\`\`typescript
console.log(0.1 + 0.2);         // 0.30000000000000004
console.log(0.1 + 0.2 === 0.3); // false
\`\`\`

Esse resultado não é bug do JavaScript. É consequência direta do padrão IEEE 754, o formato de ponto flutuante de precisão dupla usado pela maioria das linguagens modernas para representar números reais.

O problema é estrutural: computadores armazenam números em binário. E exatamente como 1/3 não tem representação finita em decimal (0.333...), muitos números decimais simples não têm representação finita em binário.

0.1 em binário é 0.0001100110011... — infinito e periódico. O processador guarda uma aproximação de 64 bits. Quando você soma dois números que já são aproximações, o erro se acumula.

## Por que isso é crítico em sistemas financeiros

Em código editorial ou de interface, um erro de \`0.00000000000000004\` é irrelevante. Ninguém percebe.

Em sistemas financeiros, a escala muda:

\`\`\`typescript
// Processando 10.000 transações de R$ 0,10
let total = 0;
for (let i = 0; i < 10000; i++) {
  total += 0.1;
}
console.log(total); // 999.9999999999181 em vez de 1000.00
\`\`\`

Erros de centavos em operações individuais viram erros de reais em agregações. Em relatórios fiscais, conciliações bancárias e auditorias, a discrepância aparece e não tem explicação óbvia — porque não existe um ponto de falha claro, é acúmulo de imprecisão distribuída.

Pior: o erro não é determinístico da perspectiva do usuário. A mesma sequência de operações em ordens diferentes pode produzir resultados ligeiramente diferentes, tornando a reprodução de bugs financeiros genuinamente difícil.

## A solução correta: inteiros de menor denominação

A solução padrão para sistemas financeiros é não usar \`float\` para dinheiro. Ponto.

Represente valores em centavos (ou a menor unidade da moeda) como inteiros. Inteiros em JavaScript são exatos até \`Number.MAX_SAFE_INTEGER\` (2⁵³ − 1), o que cobre qualquer valor monetário razoável.

\`\`\`typescript
// Ruim: float
const price = 29.99;
const quantity = 3;
const total = price * quantity; // 89.97000000000001

// Correto: inteiros de centavos
const priceInCents = 2999; // R$ 29,99
const totalInCents = priceInCents * quantity; // 8997 (exato)

// Exibição para o usuário — conversão apenas na borda de apresentação
const displayTotal = (totalInCents / 100).toFixed(2); // "89.97"
\`\`\`

A regra de ouro: receba o valor do usuário como string, converta para inteiro de centavos imediatamente, armazene como inteiro, opere como inteiro, converta para display apenas na camada de apresentação.

## BigInt para valores que excedem o limite seguro

Para moedas com mais casas decimais — como criptomoedas, onde 8 casas são comuns — ou para valores que podem exceder o limite do \`Number.MAX_SAFE_INTEGER\`, \`BigInt\` é a alternativa correta.

\`\`\`typescript
// Bitcoin: unidade mínima é satoshi (100 milhões por BTC)
const satoshisPerBitcoin = 100_000_000n;

// Conversão: multiplica pela unidade mínima antes de qualquer operação aritmética
const valueInBtc = '1.23456789';
const valueInSatoshis = BigInt(Math.round(parseFloat(valueInBtc) * 100_000_000));

// Operações são exatas
const fee = 50_000n; // 0.0005 BTC em satoshis
const netValue = valueInSatoshis - fee; // exato
\`\`\`

O custo do \`BigInt\` é que ele não interopera diretamente com operadores aritméticos de \`Number\`. Você precisa de conversão explícita e não pode misturar os dois tipos sem coerção.

## Decimal.js para quando inteiros não são suficientes

Quando o domínio requer operações com ponto decimal que devem ser precisas — taxas de juros compostos, proporções, conversões cambiais — inteiros simples não bastam porque você inevitavelmente precisa dividir.

\`\`\`typescript
import Decimal from 'decimal.js';

// Divisão com float nativo
const rate = 1 / 3;
console.log(rate * 3); // 0.9999999999999999

// Divisão com Decimal.js
const decRate = new Decimal(1).div(3);
const result = decRate.mul(3);
console.log(result.toString()); // "1"
\`\`\`

\`Decimal.js\` implementa aritmética decimal com precisão configurável, sem as limitações do IEEE 754. O custo é verbosidade e overhead de objeto para cada operação.

A escolha entre inteiros e \`Decimal.js\` depende do domínio: valores de transação em reais e centavos pedem inteiros; cálculos de juros, taxas proporcionais e conversões cambiais pedem \`Decimal.js\`.

## Onde o arredondamento quebra conciliações

Outro ponto frequentemente ignorado: onde você arredonda importa tanto quanto como você arredonda.

\`\`\`typescript
// Ruim: arredonda parciais antes de somar
const items = [19.99, 29.99, 0.01];
const total = items.reduce((acc, val) => acc + Math.round(val * 100) / 100, 0);
// Arredondamento acumulado pode divergir do total esperado

// Correto: opera em inteiros, arredonda apenas no final
const itemsInCents = [1999, 2999, 1];
const totalInCents = itemsInCents.reduce((acc, val) => acc + val, 0); // 5000 (exato)
const displayTotal = (totalInCents / 100).toFixed(2); // "50.00"
\`\`\`

Arredondar no meio do cálculo é onde conciliações bancárias costumam divergir. A regra é simples: arredonde apenas na borda de exibição, nunca dentro da lógica de negócio.

## O que verificar em sistemas existentes

Se você está auditando um sistema financeiro, os pontos de atenção são:

- Campos de valor como \`FLOAT\` ou \`DOUBLE\` no banco de dados (deveriam ser \`NUMERIC\` ou \`BIGINT\`)
- Operações com \`parseFloat\` seguidas de aritmética direta
- \`toFixed()\` aplicado no meio de cálculos em vez de apenas na exibição
- Somas iterativas de valores decimais sem acumulador inteiro

Nenhum desses itens é necessariamente um bug imediato. Mas cada um é uma fonte potencial de inconsistência que vai aparecer em volume ou em operações edge case.

## O padrão IEEE 754 não é erro de design

Vale dizer: IEEE 754 é um padrão sólido para o problema que resolve. Representação de ponto flutuante binário é eficiente, universalmente suportada em hardware, e correta para cálculos científicos, gráficos, física simulada, machine learning.

O erro é usar a ferramenta errada para o problema errado. Dinheiro não é científico — é contábil. Contabilidade exige exatidão decimal, não eficiência de ponto flutuante.

Entender o padrão que está sendo violado é o que diferencia quem corrige a causa do bug de quem adiciona um \`+ 0.001\` para "ajustar" o resultado.

## Como armazenar valores monetários no banco

A representação correta não termina no código da aplicação. O banco de dados também precisa usar o tipo certo — e é onde a maioria dos sistemas legados escorrega.

\`\`\`sql
-- Ruim: FLOAT armazena com imprecisão de ponto flutuante
CREATE TABLE payments (
  amount FLOAT NOT NULL
  -- 29.99 pode ser armazenado como 29.990000000000001
);

-- Correto opção 1: inteiro de centavos — simples, rápido, exato
CREATE TABLE payments (
  amount_cents INTEGER NOT NULL
  -- 2999 para R$ 29,99
);

-- Correto opção 2: NUMERIC com precisão explícita
CREATE TABLE payments (
  amount NUMERIC(15, 2) NOT NULL
  -- aritmética decimal exata no próprio banco
);
\`\`\`

\`NUMERIC(15, 2)\` no PostgreSQL é aritmética decimal exata — sem as imprecisões do \`FLOAT\`. O custo é que operações sobre \`NUMERIC\` são mais lentas que \`FLOAT\` em queries analíticas pesadas. Para sistemas transacionais com volumes normais, essa diferença é negligenciável. Para sistemas financeiros, é uma troca obrigatória.

Mudar o tipo de um campo de \`FLOAT\` para \`NUMERIC\` num banco com milhões de registros e código espalhado em dezenas de serviços é uma operação cara — migração de schema, conversão de dados, atualização de queries. Modelar corretamente desde o início custa zero esforço adicional.

## Conclusão

O erro de \`0.1 + 0.2 ≠ 0.3\` não é uma curiosidade acadêmica — é um sinal de que a ferramenta padrão para números reais foi construída para ciência e engenharia, não para contabilidade. IEEE 754 é preciso dentro das suas premissas. O problema aparece quando você importa essas premissas para um domínio onde exatidão decimal é requisito, não conveniência.

A correção é simples em princípio: represente dinheiro como inteiros de centavos, use \`NUMERIC\` no banco, converta para display apenas na borda de apresentação, use \`Decimal.js\` quando o domínio exige aritmética fracionária precisa com taxas ou proporções. Cada uma dessas práticas existe porque alguém descobriu a falha em produção — em conciliação bancária, em relatório fiscal, em auditoria — antes de você.

O que diferencia um sistema financeiro sólido de um que tem "pequenas discrepâncias que aparecem às vezes" é frequentemente essa decisão de modelagem tomada no início do projeto. Erros de centavos em operações individuais são ignoráveis. Erros de centavos multiplicados por milhões de transações, em relatórios regulatórios, não são.`,
  status: 'published' as const,
  order: 4,
  publishedAt: new Date('2026-05-15T12:00:00.000Z'),
  tagSlugs: ['ieee-754', 'financial-systems', 'javascript', 'typescript', 'ponto-flutuante'],
};
