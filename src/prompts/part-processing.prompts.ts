// Prompt para buscar preços no Mercado Livre
export function buildPricesPrompt(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): string {
  const description = partDescription ? ` ${partDescription}` : '';
  return `Você é um agente de pesquisa especializado em Mercado Livre (Brasil). Sua tarefa é encontrar *apenas anúncios de itens USADOS* para a peça especificada e retornar *somente* um JSON válido conforme o esquema fornecido, sem comentários, sem texto adicional e sem markdown.

## Variáveis de entrada

* partName: nome da peça (ex.: “farol”, “amortecedor”)
* description: detalhes úteis (ex.: “lado esquerdo”, “original”, “com sensor”)
* vehicleBrand: marca do veículo (ex.: “Volkswagen”)
* vehicleModel: modelo do veículo (ex.: “Gol”)
* vehicleYear: ano do veículo (ex.: “2014”)

Forme a consulta de busca com:

${partName} ${description} ${vehicleBrand} ${vehicleModel} ${vehicleYear}


(ignorando campos vazios).

## Restrições obrigatórias

1. *Busque apenas no Mercado Livre Brasil*: domínios permitidos

   * https://lista.mercadolivre.com.br/…
   * https://produto.mercadolivre.com.br/…
2. *Condição do item: USADO*. Ignore anúncios “Novo”, recondicionados ou genéricos sem condição clara.
3. Considere apenas *preço à vista* do produto (sem frete, sem juros de parcelamento, sem descontos de cupons).
4. *Moeda BRL*. Converta os valores para número decimal com ponto (ex.: 1234.56), removendo R$, pontos de milhar e vírgulas decimais.
5. *Evite duplicatas*: dedupe por ID do anúncio (ex.: “MLB” no link) e por mesmo título+preço.
6. *Relevância*: o título deve conter a peça e (preferencialmente) o modelo/ano ou compatibilidade claramente relacionada. Descarte resultados de outras peças, kits que distorcem preço, ou anúncios sem relação clara.
7. *Somente Brasil* (ignore vendedores de outros países).

## Procedimento de busca (OBRIGATÓRIO - USE FERRAMENTAS DE BUSCA)

**ATENÇÃO:** Você tem acesso à busca do Google. SEMPRE use esta ferramenta.

1. **BUSQUE AGORA** usando ferramentas de busca do Google: "site:mercadolivre.com.br ${partName} ${vehicleBrand} ${vehicleModel} usado"
2. **ACESSE OS LINKS REAIS** dos primeiros 10-30 resultados encontrados HOJE
3. Para cada anúncio ATUAL encontrado, confirme:

   * Condição “Usado”
   * Preço à vista visível
   * Compatibilidade com {vehicleBrand} {vehicleModel} {vehicleYear} (pelo título/descrição; se houver tabela de compatibilidade, melhor).
4. Extraia:

   * link (URL canônica do anúncio)
   * price (número decimal em BRL, à vista)
5. Limpe e dedupe a lista.

## Cálculo de preços

* min_price: menor preço da amostra válida.
* max_price: maior preço da amostra válida.
* suggested_price: *mediana* dos preços válidos (se houver 3+ anúncios);
  se houver 2 anúncios, use a média simples;
  se houver 1 anúncio, use o próprio preço.
* Arredonde para duas casas decimais.

## Saída (obrigatória)

Retorne *APENAS* o JSON válido, exatamente neste formato e ordem de chaves:


{
  "prices": {
    "min_price": <number>,
    "suggested_price": <number>,
    "max_price": <number>
  },
  "ads": [
    {
      "link": "<string>",
      "price": <number>
    }
  ]
}


### Regras de saída

* Não inclua propriedades extras.
* Se nenhum anúncio válido for encontrado, retorne:


{
  "prices": {
    "min_price": 0,
    "suggested_price": 0,
    "max_price": 0
  },
  "ads": []
}


## Qualidade e segurança

* Verifique se todos os link começam com https://produto.mercadolivre.com.br/ e estão ativos.
* Ignore resultados patrocinados irrelevantes.
* Remova anúncios de “lotes/kits” quando inviabilizarem a comparação com uma unidade da peça.
* Preferir anúncios com fotos reais e descrição clara; se houver muitos iguais, mantenha os de melhor reputação do vendedor (quando visível).

## Execução

Agora, execute o procedimento usando as variáveis recebidas e *retorne apenas o JSON* especificado.`;
}

// Prompt para gerar descrição do anúncio
export function buildAdDescriptionPrompt(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): string {
  const description = partDescription ? ` ${partDescription}` : '';
  return `Crie uma descrição atrativa para anúncio da peça ${partName}${description} do veículo ${vehicleBrand} ${vehicleModel} ${vehicleYear}. Evite usar aspas não balanceadas e caracteres que quebrem JSON.

Retorne JSON:
{
  "ad_description": "descrição da peça para anúncio"
}

Retorne APENAS o JSON válido.`;
}

// Prompt para estimar dimensões
export function buildDimensionsPrompt(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): string {
  const description = partDescription ? ` ${partDescription}` : '';
  return `Estime as dimensões aproximadas da peça ${partName}${description} do veículo ${vehicleBrand} ${vehicleModel} ${vehicleYear}.

Retorne JSON:
{
  "dimensions": {
    "width": "largura (integer number)",
    "height": "altura (integer number)",
    "depth": "profundidade (integer number)",
    "unit": "cm"
  }
}

Retorne APENAS o JSON válido.`;
}

// Prompt para estimar peso
export function buildWeightPrompt(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): string {
  const description = partDescription ? ` ${partDescription}` : '';
  return `Estime o peso aproximado da peça ${partName}${description} do veículo ${vehicleBrand} ${vehicleModel} ${vehicleYear}.

Retorne JSON:
{
  "weight": peso_numero_em_kg
}

Retorne APENAS o JSON válido.`;
}

// Prompt para determinar compatibilidade
export function buildCompatibilityPrompt(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): string {
  const description = partDescription ? ` ${partDescription}` : '';
  return `Liste veículos compatíveis com a peça ${partName}${description} do veículo ${vehicleBrand} ${vehicleModel} ${vehicleYear}. Se não houver outros veículos compatíveis, retorne apenas o veículo de onde a peça veio.

Retorne JSON:
{
  "compatibility": [
    {
      "brand": "marca",
      "model": "modelo",
      "year": "anos"
    }
  ]
}

Retorne APENAS o JSON válido.`;
}

// Função original mantida para compatibilidade
export function buildPartProcessingPrompt(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): string {
  const description = partDescription ? ` ${partDescription}` : '';
  return `Realize uma busca no mercado livre para encontrar o melhor preço para a peça (usada) ${partName}${description} do veículo ${vehicleBrand} ${vehicleModel} ${vehicleYear}.

Retorne JSON:
{
  "prices": {
    "min_price": preco_min_numero,
    "suggested_price": preco_sugerido_numero,
    "max_price": preco_max_numero
  },
  "ad_description": "descrição da peça para anúncio",
  "dimensions": {
    "width": "largura (integer number)",
    "height": "altura (integer number)", 
    "depth": "profundidade (integer number)",
    "unit": "cm"
  },
  "weight": peso_numero,
  "compatibility": [
    {
      "brand": "marca",
      "model": "modelo", 
      "year": "anos"
    }
  ]
}

Retorne APENAS o JSON válido.`;
} 