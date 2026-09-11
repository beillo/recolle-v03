# Log do radar EySMunicipales

Append-only, uma entrada por execução da skill `/eys`. Registra o que **não**
entrou tanto quanto o que entrou: sem isso não há como auditar o filtro depois,
só confiar nele.

A base em si vive no Notion, em `Radar EySMunicipales`, dentro da página
`🥬 Recolle`. Aqui fica só o rastro.

---

## 2026-09-11 — backfill do arquivo completo

Primeira execução. `node scripts/eys-fetch.js --all` e
`node scripts/eys-report.js --all`.

**Corpus:** 359 edições extraídas, 5.506 notícias, 5.244 únicas por URL,
de 2019-07-18 a 2026-09-11. O arquivo era muito maior do que o previsto no
plano: recua até 2018, não até novembro de 2025, e a paginação `1 2 3 Siguiente`
é uma janela, não o total.

**Três templates de e-mail, não um.** A, de 2022-12-02 em diante, com campos
Drupal nomeados, 191 edições. B, de 2019-07-18 a 2022-11-25, tabela com classes
`noticia-title` e `noticia-subtitle`, 168 edições, **sem campo de categoria**.
C, de 2018-09-28 a 2019-07-11, 41 edições, deliberadamente não suportada: é o
período mais antigo e menos relevante, e seria um terceiro parser para manter
para sempre. O script reporta essas 41 como omissão registrada, não como erro,
para que uma deriva futura de verdade continue falhando alto.

**Entraram 12 insights**, todos com `Status = Pendente`. Por eixo: Mercado 3,
Nicho adjacente 2, Concorrência 2, Regulação 2, Método 2, Prova do problema 1.

Os quatro marcados como `Agir`:

- A UTE Copasa-Setec levou Ourense e Ferrol, os dois maiores contratos de
  resíduos da Galícia, ambos por dez anos.
- Ferrol operou o serviço mais de uma década **sem concessão vigente**.
- Zonas verdes é o único nicho adjacente com volume de contrato comparável:
  70 notícias de contrato contra 247 de resíduos, e Las Palmas licitando 96,8 M€.
- Já existe IA embarcada no caminhão medindo impropios (MAWIS.AI VIEW), isto é,
  o operador auditando a si mesmo com a ferramenta que seria do recolle.

**Duas contagens que tensionam a tese**, registradas de propósito: `impropios`
aparece 5 vezes em sete anos e `tasa / pago por generación` 15, num corpus de
5.244 notícias onde recolha de resíduos aparece 1.297 vezes.

Nenhuma conclusão tirada. As duas hipóteses seguem abertas: oportunidade pouco
explorada, ou demanda insuficiente. Este corpus sozinho não separa as duas, e
não deve ser usado como se separasse — é imprensa de setor, que reflete o que dá
pauta, não necessariamente o que move compra municipal. Pliegos de licitação
seriam a fonte que decide.

**Uma divergência aparente, resolvida no mesmo dia.** Levantei como contradição
o fato de a notícia de Rivas Vaciamadrid citar "el objetivo que dicta la ley de
un 20% para 2027" enquanto o `docs/decisions.md` registra "<15% de impropios até
2027". Não era contradição: a Ley 7/2022 tem os dois patamares, 20% de 2022 a
2026 e 15% a partir de 2027. A notícia cita o teto vigente, o `decisions.md`
cita o teto futuro, e ambos estão certos. O erro foi meu, de ler como divergência
o que era uma escala temporal.

Fica a leitura útil: Rivas, com menos de 10%, já cumpre hoje o regime que só
passa a valer em 2027. O aperto de 2027 não é abstrato, e a assimetria entre
quem publica número e quem não publica é o espaço do recolle.

**Rejeitado:** o grosso das 5.244 notícias. As famílias descartadas foram
infraestrutura verde sem contrato, urbanismo, mobilidade, alumbrado (registrado
como negativo explícito, para não voltar), lançamento de produto sem número, e
25 autopromoções da própria revista ("Lee ya la edición digital").

**Correções feitas no caminho:** entidades `&sup2;` e afins não decodificavam
porque o regex de entidades nomeadas era `[a-z]+`; uma varredura pelo corpus
achou mais nove entidades reais que faltavam na tabela. Referências numéricas na
faixa 0x80–0x9F produziam surrogates soltos, que quebram a escrita de JSON, e
passaram a ser tratadas como Windows-1252, que é o que de fato significam. No
relatório, a contagem de menções editoriais usava substring e dava ao anunciante
`ida` mais de dois mil acertos dentro de "recogida" e "medida".

E uma correção que já tinha vazado para a base: o relatório contava as 5.506
ocorrências em vez das 5.244 notícias únicas, porque a newsletter repete
destaques em edições diferentes. Três números comparativos gravados no Notion
saíram inflados por isso (resíduos 1.359 em vez de 1.297, contratos 509 em vez
de 492, zonas verdes 696 em vez de 664) e foram corrigidos nas páginas. O
`prepare()` do relatório passou a deduplicar por URL, que é o que a própria
skill já mandava fazer.
