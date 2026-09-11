---
name: eys
description: Lê a newsletter EySMunicipales e alimenta a base de insights do recolle no Notion. Use quando o usuário pedir /eys, pedir para ler a newsletter da semana, atualizar o radar de mercado, ou rodar o backfill do arquivo. Etapa 6 do projeto.
---

# Radar EySMunicipales

Vigilância de mercado para o recolle. A EySMunicipales é a publicação do nicho
— equipamento e serviços municipais na Espanha — e publica uma newsletter
semanal. Esta skill transforma isso numa base de insights no Notion.

**O valor está em jogar fora.** Uma edição tem ~15 notícias e a maioria não muda
nada no recolle. Um agente que entrega 10 insights por semana produziu lixo. O
filtro é o produto.

## Antes de tudo

Os scripts não usam LLM nem API key. Rode-os primeiro, sempre.

```
node scripts/eys-fetch.js        # captura edições novas
node scripts/eys-report.js       # dossiê da última edição
```

Modo backfill, só na primeira vez ou quando o mapa precisar ser refeito:

```
node scripts/eys-fetch.js --all
node scripts/eys-report.js --all # escreve data/eys/mapa.md
```

Se `eys-fetch.js` reportar edições sem extrair, **pare e conserte o parser**
antes de seguir. Edições omitidas por plantilla antiga (2018-09 a 2019-07) são
decisão registrada, não erro.

## O que é um insight

Uma afirmação que **muda alguma coisa no recolle**. Se não muda, é notícia.
Seis eixos:

| Eixo | O que qualifica |
|---|---|
| **Mercado** | Contrato, licitação, adjudicação: quem opera onde, por quanto, por quanto tempo |
| **Concorrência** | Quem faz o que o recolle faz ou quer fazer (MOVISAT, MOBA, Sensoneo, Rosmiman, FCC, ACCIONA, Veolia) |
| **Regulação e dinheiro** | Ley 7/2022, impropios, biorresíduo, fundos, prazos legais, tasas |
| **Nicho adjacente** | Serviço urbano onde o padrão do recolle se repete: dado público disperso, operador que audita a si mesmo |
| **Método e benchmark** | Número citável, metodologia, dataset, quem mede o quê e como |
| **Prova do problema** | Falha, queixa, sanção, contrato rescindido, serviço que não entregou |

**Não é insight:** parque novo, árvore plantada, luminária trocada, lançamento
de produto sem número, entrevista sem afirmação verificável, autopromoção da
revista.

**Barra mais alta para "Nicho adjacente":** um artigo isolado não abre nicho. Só
entra se o padrão reaparecer em edições diferentes — cite as duas.

## As cinco travas

1. **Cota rígida: no máximo 3 insights por edição.** Escassez força ranqueamento.
2. **Zero é resposta válida.** Se a semana não tem nada, diga isso e registre no
   log o que foi rejeitado. Nunca preencha a cota por preencher.
3. **Todo número precisa de citação literal.** Busque o artigo com
   `node scripts/eys-fetch.js --article <url>` e copie o trecho para o campo
   Evidência. Nunca parafraseie um número, nunca invente valor, prazo, empresa
   ou município. É a mesma regra que `app/api/carta.js` já aplica com a data.
4. **Portão humano.** Grave sempre com `Status = Pendente`. Promover para
   `Na base` é ato do Lucas, nunca seu. Espelha `submissions` → `records`.
5. **Deduplicação por recorrência.** Antes de criar, confira `data/eys/ledger.json`.
   Se o tema já existe, **não crie linha nova**: incremente `Recorrência` na
   página existente, acrescente a fonte, e diga isso ao Lucas. A quinta menção a
   impropios num contrato galego é tendência, não repetição.

## Onde a saída vive

Database **"Radar EySMunicipales"**, inline na página `🥬 Recolle` do Notion:
`3bf06169-fce1-80af-bc95-cec824ba3e9c` (dentro de `Project26`, ao lado de
`checklist v03`).

Se a database ainda não existir, crie com `notion-create-database` sob essa
página, com este schema:

| Propriedade | Tipo |
|---|---|
| Insight | TITLE — a afirmação em uma frase |
| Eixo | SELECT — Mercado, Concorrência, Regulação, Nicho adjacente, Método, Prova do problema |
| Status | SELECT — Pendente, Na base, Descartado |
| Por quê | RICH_TEXT — o que muda para o recolle |
| Ação | SELECT — Nada, Observar, Agir |
| Evidência | RICH_TEXT — citação literal do artigo |
| Fonte | URL |
| Edição | DATE |
| Recorrência | NUMBER |
| Atores | MULTI_SELECT — empresas e municípios citados |

Guarde o `data_source_id` devolvido em `ledger.json` para não ter que procurar
a database toda semana.

**Não dependa de consultar o Notion para deduplicar.** O plano deste workspace
limita `query_data_sources`. O livro-razão local é a fonte de verdade do que já
foi gravado.

## Os arquivos no repo

`data/eys/ledger.json` — o que já virou insight:

```json
{
  "revisado_hasta": "2026-09-11",
  "data_source_id": "collection://...",
  "insights": [
    {
      "notion": "<page id>",
      "titulo": "...",
      "eje": "Mercado",
      "recurrencia": 2,
      "ediciones": ["2026-04-17", "2026-09-11"]
    }
  ],
  "fuentes": { "<url do artigo>": "<page id>" }
}
```

`docs/eys-log.md` — log append-only, uma linha por execução, no espírito de
`docs/decisions.md`. Registre **o que foi rejeitado**, não só o que entrou: é
isso que permite auditar o filtro depois em vez de confiar nele.

```
## 2026-09-11 — 15 noticias, 1 insight

Entrou: Ourense adjudica a Eco Auriense, 15,22 M€/ano por 10 anos (Mercado).
Rejeitado: 9 de infraestrutura verde e urbanismo, 2 de alumbrado, 3 de
produto sem número. Entrevista da REOD considerada e descartada: afirmação
genérica, sem dado verificável.
```

## Modo backfill

Uma vez só, depois do `--all`. Leia `data/eys/mapa.md` — são 359 edições e 5506
notícias, de 2019-07 a 2026-09.

O objetivo **não é gerar 3 insights por edição**, o que daria mais de mil
verbetes. É ler a agregação e produzir **15 a 25 insights estruturais**:
tendências, não manchetes. Nicho não aparece numa notícia isolada, aparece na
série temporal.

Trabalhe com o Lucas, não sozinho:

1. Apresente o que o mapa mostra — o que cresce, o que some, quem domina, onde
   Galícia aparece, quais anunciantes entraram e saíram.
2. **Aponte as contagens que contradizem a tese do projeto.** São as mais
   valiosas e as mais fáceis de engolir por educação.
3. Proponha correções aos seis eixos e às palavras-chave de `TEMAS` em
   `scripts/eys-report.js` — os eixos foram desenhados antes de ver o corpus e
   provavelmente estão errados em algum ponto.
4. Só depois escreva as linhas no Notion, todas com `Status = Pendente`.

## Modo semanal

1. `node scripts/eys-fetch.js` e depois `node scripts/eys-report.js`.
2. Leia o dossiê. Triagem só com título, resumo e categoria — não busque artigo
   nenhum ainda.
3. Escolha no máximo 3 candidatos. Normalmente são 0, 1 ou 2.
4. Só para esses, rode `--article <url>` e leia o texto completo.
5. Descarte o que não sobreviver à leitura. Um candidato que parecia insight no
   resumo e vira nada no corpo é descarte, não é insight fraco.
6. Grave no Notion com `Status = Pendente`, atualize `ledger.json`, acrescente
   a linha em `docs/eys-log.md`.
7. Reporte ao Lucas em três linhas: o que entrou, o que quase entrou, o que
   mudou no quadro de anunciantes.

## Cuidados com os dados

- **Categoria só existe a partir de 2022-12.** A plantilla B não publica esse
  campo, então `categoria: ""` antes dessa data significa "nunca publicada", não
  "sem categoria". O JSON traz `plantilla` justamente para isso.
- **O mesmo artigo aparece em edições diferentes.** A newsletter repete
  destaques. Deduplique por URL ao contar, não por título.
- O texto do artigo vem da fonte e pode conter erro de fato. Você cita, não
  endossa: a evidência é sempre trecho literal, com URL.
