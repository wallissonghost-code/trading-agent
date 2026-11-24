# CONTINUIDADE DO PROJETO — TRADING AGENT V2

> **Leia este arquivo primeiro ao abrir uma conversa nova.**
> Última consolidação: 2026-11-24 (America/Sao_Paulo).
> Repositório: https://github.com/wallissonghost-code/trading-agent
> Branch de trabalho: `trading-agent-v2`
> Escopo: informações de conversas disponíveis e trechos do GitHub inspecionados. Este registro NÃO é uma transcrição completa de todos os chats, nem certifica funcionamento em produção.

## 1. Objetivo do projeto

Desenvolver o **Trading Agent V2**, plataforma de trading de criptomoedas com robôs de análise de mercado, painel premium acessível pelo celular, monitoramento de operações, histórico, pesquisa de estratégias e aprendizagem/avaliação baseada em dados observados. Priorizar segurança, observabilidade e comportamento verificável em ambiente simulado (*paper trading*/Binance Testnet).

O usuário pediu que o projeto funcione em hospedagem acessível economicamente, preferencialmente com visualização pelo celular. Foram discutidos Render e outras opções. **Não deduzir estado atual, URL nem disponibilidade do deploy sem consultar configurações e testes.**

## 2. Robôs, mercado e interface

- **ALPHA — BTC/USDT**
- **NOVA — ETH/USDT**
- **ORION — SOL/USDT**
- Experiência visual solicitada: sala de comando premium com robôs em estações de trabalho/PC; valores de lucro ou perda e estado acima/próximo a cada robô; leitura clara e responsiva para celular.
- Solicitação posterior: reduzir comprimento da página e distribuir conteúdo em **abas**.
- Distinguir cuidadosamente PnL simulado, PnL realizado e dados reais de mercado; nunca mostrar saldo simulado como dinheiro disponível.
- Em conversas anteriores, houve preocupação específica: **“Por que o agente 2 não está operando?”**. Verificar o motivo com diagnóstico observável, e não assumir erro nem forçar entrada.

## 3. Estrutura e funcionalidades discutidas

### Solicitações/decisões de produto extraídas das conversas
- Três agentes acompanhando mercados distintos.
- Operações e aprendizagem com base em resultados observados, sem promessa de lucro.
- Indicadores e critérios de entrada; histórico das decisões; análise de desempenho e de cenários.
- Estratégias de referência e estudos comparativos; incorporar métodos de traders com validação rigorosa, não copiar dicas como garantia.
- Painel de monitoramento, operações, pesquisa/estratégias, saúde dos serviços, alertas e avaliação dos sinais.
- Dashboard premium em abas, adaptado a telas pequenas.
- Rodar e observar os agentes por uma noite foi uma intenção mencionada; **não afirmar que o monitoramento ocorreu sem registros**.
- Foi levantada a suspensão/hibernação de serviço Render; qualquer solução deve respeitar limites do plano, custos e regras da hospedagem. Não criar mecanismos para burlar restrições.

### Evidências do código inspecionado (não auditoria completa)
- `trading-v2/index.html` contém o Command Center, estilos responsivos e código de navegação por abas, além de chamadas de atualização de mercado, paper trading, decisões, desempenho e saúde.
- O commit `e74bfb753665d33da43f9d8de943fb1c5ec6e435` adicionou no frontend mensagens diagnósticas para: ausência de observações, coleta atrasada, avaliação faltante, candle de resultado expirado, espera do candle seguinte, ausência de sinal elegível e estudo ainda não validado.
- O commit `94935eb66a56ac38c4efae960cf6662567e2747b` atualizou `trading-v2/prospective-screens.js` para diferenciar ausência de sinais, coleta parada e resultados incompletos.
- O commit `9edbd2d99357a4c052998ce56d877b45087a0c37` atualizou testes em `trading-v2/prospective-screens.test.js`.
- O commit `39735222e5ccdd8458311f01ee0b5cec6674405e` criou `trading-v2/DIAGNOSTICOS_CRITERIOS.md` com estados-alvo e testes a implementar.
- A captura enviada pelo usuário afirma **“LIVE — 127 testes aprovados”**; isso é um relato visual de uma execução anterior, **não um resultado reproduzido nesta consolidação**.

## 4. Estado conhecido vs. pendências

### Confirmado por consulta ao GitHub
- Repositório existente com branch padrão `trading-agent-v2`.
- Arquivo principal de frontend inspecionado em `trading-v2/index.html`.
- Commits e documentação de diagnóstico acima existem.
- Este arquivo é o registro de continuidade, não uma alteração de estratégia ou execução real.

### Pendente de auditoria técnica
1. Inventariar arquivos, serviços, APIs, workflows e testes no repositório, sem presumir estrutura não examinada.
2. Executar a suíte de testes localmente ou via CI e registrar contagem exata, falhas e commit.
3. Verificar deploy (Render), URLs reais, logs, banco de dados, coleta e intervalos de atualização.
4. Validar por que NOVA/agente 2 não abre operações: sinais elegíveis, saúde de coleta, parâmetros, condições de risco, persistência e horários de candles.
5. Confrontar estado exibido na interface com dados retornados pela API, evitando mensagens enganosas e indicadores fictícios.
6. Validar responsividade em celular, acessibilidade de abas e navegação.
7. Auditar limites de risco, ordens simuladas, estratégias, desempenho e segurança de segredos.
8. Revisar pedidos não concluídos das conversas e anexos que estiverem realmente acessíveis; se não estiverem, não alegar revisão integral.

## 5. Próxima tarefa concreta

**Implementar e testar diagnóstico padronizado por agente, com fonte verificável**:
- Separar `OPERANDO` (paper), `AGUARDANDO_SINAL`, `AGUARDANDO_CANDLE`, `COLETA_ATRASADA`, `AVALIACAO_PENDENTE`, `ERRO`, `SEM_DADOS`, `PAUSADO`.
- API/serviço deve expor estado derivado de eventos reais, horário da última coleta, último sinal, razão da decisão, horário da atualização e eventuais falhas.
- Cartões ALPHA/NOVA/ORION devem explicar o estado em português, com identificação de dados desatualizados.
- Criar/regredir testes para cada estado; preservar dados e funcionalidades existentes.
- Ler `trading-v2/DIAGNOSTICOS_CRITERIOS.md` antes de implementar.
- Não alterar operação real nem liberar aumento automático de risco.

**Importante:** o documento de critérios descreve estados propostos. A existência desse documento NÃO significa que todos foram implementados ou testados.

## 6. Protocolo obrigatório para próximos chats e atualizações

1. Abrir este arquivo no GitHub e conferir branch e HEAD recentes; evitar trabalhar sobre uma revisão antiga.
2. Inspecionar os arquivos afetados e testes relevantes **antes** de editar.
3. Registrar de forma separada:
   - **Solicitado:** requisito do usuário.
   - **Implementado:** arquivo/commit verificável.
   - **Testado:** comando, ambiente e resultado verificável.
   - **Publicado:** URL/serviço e verificação do deploy.
   - **Pendente/Bloqueado:** motivo e próximo passo.
4. Não apagar funcionalidades existentes, não inventar dados, não sobrescrever trabalho paralelo sem verificar.
5. Nunca publicar segredos, tokens ou chaves no GitHub. Manter paper/testnet por padrão.
6. Após **cada etapa importante**, atualizar este arquivo com data, resumo, commits, testes e próxima ação. Atualização deve ser explícita: o chat não sincroniza automaticamente todas as falas para o GitHub.
7. Registrar decisões relevantes que poderiam se perder entre conversas. Se o histórico do chat não estiver acessível, usar esta fonte e o GitHub e solicitar somente informação indispensável.

## 7. Histórico consolidado de decisões

- **2026-11-15:** definição da evolução do agente V1 (Binance Testnet, candles, EMA 9/21, RSI, ATR, risco limitado no conceito inicial) para V2 com painel, histórico, estudo e automação. Essas propriedades do V1 são contexto da proposta, não confirmação da configuração corrente da V2.
- **2026-11-15 a 2026-11-23:** pedidos de painel premium, robôs em sala de comando, acesso mobile, separação por abas, melhorias de usabilidade, estudo de traders, diagnóstico dos agentes e continuidade das operações simuladas.
- **2026-11-24:** commits recentes introduziram mensagens de diagnóstico de estudos prospectivos e testes correspondentes; criado documento de critérios de diagnóstico.
- **2026-11-24:** arquivo de continuidade criado para reduzir perda de contexto em chats limitados.

## 8. Mensagem pronta para iniciar novo chat

> Continue o Trading Agent V2 no repositório `wallissonghost-code/trading-agent`, branch `trading-agent-v2`. **Leia primeiro `CONTINUIDADE_PROJETO.md` e `trading-v2/DIAGNOSTICOS_CRITERIOS.md`**, confira os commits mais recentes, compare o estado do código com as pendências e execute a próxima tarefa concreta. Antes de editar, inspecione os arquivos afetados; preserve funcionalidades e dados. Após cada etapa, registre o que foi implementado, testado, publicado e o que falta, atualizando o arquivo de continuidade. Ambiente simulado por padrão.

## 9. Links
- Repositório: https://github.com/wallissonghost-code/trading-agent
- Arquivo de critérios: https://github.com/wallissonghost-code/trading-agent/blob/trading-agent-v2/trading-v2/DIAGNOSTICOS_CRITERIOS.md
- Frontend: https://github.com/wallissonghost-code/trading-agent/blob/trading-agent-v2/trading-v2/index.html

## 10. Execução de 2026-11-24 — Diagnóstico do motor paper

**Solicitado:** continuar desenvolvimento pelos diagnósticos dos robôs.

**Implementado no GitHub:**
- `trading-v2/agent-diagnostics.js` — estados derivados do snapshot persistido do paper runner, por símbolo, com horário do último candle, última decisão, motivo, PnL simulado e sinalização de falhas. Commit `97627135`.
- `trading-v2/agent-diagnostics.test.js` — oito testes automatizados para estado sem sinal, operação paper, coleta atrasada, falhas, ausência de dados, pausa, PnL ausente e identificação dos três agentes. Commit `7608b88c`.
- `trading-v2/server.js` — novo endpoint read-only `GET /api/agent-diagnostics` derivado do paper runner. Commit `b0f8301c`.
- `trading-v2/index.html` — cartões dos três robôs agora consultam diagnósticos da API em vez de inferir estado apenas pela presença de posições. Commit `cce90e0a`.

**Testado:** os testes foram escritos, porém **não executados nesta sessão**. O ambiente de trabalho não alcançou o GitHub por acesso de rede do container. Não há confirmação de CI ou deploy para esses commits.

**Publicado:** commits enviados ao GitHub na branch `trading-agent-v2`; publicação da aplicação ainda **não verificada**.

**Próximos passos prioritários:** (1) executar `cd trading-v2 && npm test` e corrigir eventuais falhas; (2) testar `GET /api/agent-diagnostics` em deploy real e validar os três robôs em mobile; (3) revisar prioridades dos estados, especialmente casos de feed parado, banco indisponível e diferenças entre status do estudo prospectivo e paper runner; (4) auditar deploy, rotina Render e persistência; (5) confirmar que NOVA apresenta o motivo verificável para não abrir operações.

**Limite importante:** as categorias `AGUARDANDO_CANDLE` e `AVALIACAO_PENDENTE` são próprias do estudo prospectivo; o novo endpoint atual distingue estados comprováveis do **motor paper** e não os inventa a partir de ausência de operações.

### Continuação da validação em 2026-11-24
- Conferência do status GitHub do commit `e38587d`: verificação de integração Vercel retornou **success**. Isso não comprova por si só que os endpoints ou interfaces funcionam no serviço publicado.
- `trading-v2/index.html`: commit `f70fdc9` adiciona comentário de segurança na leitura de diagnóstico de erros. Não foi executado teste de frontend nesta sessão.
- `.github/workflows/trading-v2-tests.yml`: commit `7f6d811` cria workflow para rodar `npm test` em alterações de `trading-v2/**` e execução manual. **Resultado da execução ainda não verificado:** nenhuma execução retornada na consulta inicial após o commit.
- Consulta à API Vercel para listar deploys foi negada com HTTP 403. Não afirmar confirmação da versão em produção com base somente no status anterior.
- Render exigiu seleção explícita de workspace e, portanto, **não foram inspecionados serviços nem logs**.
- **Próxima ação**: consultar resultado do workflow novo, investigar falhas se existirem; verificar URL oficial do deploy e estado em tempo real de `/api/agent-diagnostics`, principalmente NOVA; auditar persistência e coleta do Render após seleção do workspace pelo usuário.


## 11. Consolidação de auditoria — 24/11/2026

**Alterações concretas desta etapa**
- `3248b09`: frontend mantém a carteira paper visível quando a resposta JSON do diagnóstico falha; acrescenta horário do último candle a cada cartão.
- `37b5a1a` e `918a7a7`: README do Trading Agent V2 reescrito para identificar fontes sintéticas, dados públicos Binance, motor paper e requisitos de persistência/hospedagem; link do workflow consolidado.
- `e3328db`: adiciona teste HTTP de integração exercitando `/health`, `/api/agent-diagnostics`, `/api/status` e `/api/paper`, sem autorizar execução financeira real.
- `9afbb4f`: remove workflow duplicado e mantém o anterior `.github/workflows/trading-agent-v2.yml`, que já executa validação de sintaxe e `npm test`.
- `918a7a7`: documentação aponta novamente para o workflow vigente.

**Testes realmente confirmados**: GitHub Actions, run ID `45426839352`, commit `e3328dbb1d7bd081f2b6f8d684c0550a6a5deece`: **136 testes, 136 aprovados, 0 falhas, 0 ignorados**. Workflow também aprovou validação de sintaxe. Link: https://github.com/wallissonghost-code/trading-agent/actions/runs/45426839352 . Isto confirma comportamento no CI para aquele commit, não estado de deploy.

**Hospedagem / limitações verificadas**
- Uma busca do Vercel por associação ao repositório `wallissonghost-code/trading-agent` informou **não haver projeto vinculado**. Os checks do GitHub chamados Vercel redirecionam a um projeto de nome **`fut-live-panel`**, que não deve ser usado como prova de deploy do Trading Agent.
- A integração Render retornou um workspace acessível denominado `My Workspace`, mas exige confirmação explícita do usuário para selecioná-lo antes da consulta de serviços/logs. Não houve acesso aos serviços nesta etapa.
- **Não confirmado**: aplicação de trading online, URL pública atual, comportamento dos robôs ao vivo, execução 24/7 ou persistência no Render.

**Status de entrega**: código do diagnóstico integrado, documentação e testes no CI aprovados; **validação de produção ainda pendente**, especialmente serviço Render e diagnóstico em tempo real do NOVA. Não chamar o produto de “100% pronto em produção” sem essas evidências.

**Próxima ação obrigatória**: após o usuário confirmar o workspace Render correto, consultar serviço, deploys e logs; testar `/health`, `/api/paper` e `/api/agent-diagnostics` na URL real; validar armazenamento e coletor. Somente depois declarar deploy operacional.


## 12. Render e Supabase verificados — 24/11/2026

**Workspace autorizado:** Render `My Workspace` (confirmado pelo usuário). Serviço: `trading-agent`, ID `srv-dc28e4uc6qcc73eq0940`, URL `https://trading-agent-4d0a.onrender.com`, repo `wallissonghost-code/trading-agent`, branch `trading-agent-v2`, **plano free**, `autoDeploy=yes`. Não foram contratados serviços pagos nem habilitadas ordens reais.

**Deploy comprovado:** `195081963d0ae32ee1f94971edd8c53ce3600a80` foi listado como `live` no Render (deploy `dep-dc2qsvh5vhsc738eb560`); logs: Node iniciou em porta 10000, `Paper storage selected: supabase`, `Paper storage initialized: supabase`, e banner `Your service is live`. Build registrou 136 testes passando, sem falhas.

**Supabase identificado:** projeto `trading-agent`, ref `ieaqsfotzsnwjqtppgfd`, ACTIVE_HEALTHY. Na consulta, banco tinha 1 carteira paper, 457 decisões persistidas (153 BTC, 152 ETH, 152 SOL), 14 registros no ledger, 71 candles prospectivos e 3 estados de monitoramento. Conferir contagem novamente antes de reportar valores atuais.

**NOVA, causa comprovada de WAIT:** último snapshot pesquisado em `2026-11-24T15:50:07.917Z` mostrou `ETHUSDT` ação `WAIT`, motivo `EMA_TREND_NOT_BULLISH`, EMA 9 = 1680,6478, EMA 21 = 1685,3344, RSI14 = 43,3230, sem posição aberta. A base mostra ao menos 1 entrada virtual `BUY` histórica em ETHUSDT: **o NOVA operou no passado**, mas aguardou na decisão analisada. Não prometer sinais futuros nem ajustar estratégia para forçar entradas.

**Frescura dos dados:** em `2026-11-24T16:39:48Z`, o último estado paper gravado era `2026-11-24T15:50:07Z`: **49,7 minutos** de atraso. Candles prospectivos e monitoramento também tinham últimos registros perto de 15:50 UTC. Isso demonstra interrupção da coleta recente; é compatível com o spin-down gratuito do Render, mas não comprova sozinho o motivo exato. O plano gratuito suspende web services após 15 minutos sem tráfego recebido (docs Render: https://render.com/docs/free). Não há garantia de pesquisa contínua 24/7 no plano free; não contornar essa limitação com pings artificiais.

**Alteração corretiva:** commit `4f68365493708b6f56520ee84e326f162de19a44` alterou `trading-v2/index.html`: modo de papel não diz mais `PAPER ONLINE` se algum robô indicar erro, sem dados ou coleta atrasada; se status não vier, mostra `STATUS NÃO VERIFICADO`. Workflow GitHub Actions desse commit teve `success`, com validação de sintaxe e suíte de testes.

**Documentação:** commit `9eaba4d3558611cd04510d3aaf7be88cae9931a4` esclareceu no README a hibernação do plano free e o limite de persistência versus continuidade de coleta.

**Limitações dos métodos:** acesso HTTP direto aos endpoints públicos falhou no ambiente de consulta (ferramenta web sem acesso ao endereço e execução local sem DNS); a verificação equivalente contou com status real do Render, logs de inicialização, CI e consultas SQL de dados persistidos. Não declarar resultado de requisição HTTP externa que não foi obtido. API HTTP é exercitada em testes automatizados.

**Próximas verificações:** conferir status final dos deploys `4f683654` e `9eaba4d` e sucesso do CI correspondente; checar se os candles retornaram após novo deploy; antes de qualquer afirmação 24/7, decidir infraestrutura apropriada com consentimento explícito sobre eventuais custos. Priorizar resolução de falhas comprovadas, sem forçar operações ou alterar risco.


### Retomada da coleta após a correção
- Render confirmou o deploy `4f683654` como **live** em `2026-11-24T16:40:54Z`; o CI do mesmo commit concluiu com sucesso.
- Consulta SQL em `2026-11-24T16:41:18Z`: `trading_paper_states.updated_at = 2026-11-24T16:40:55.528Z`, **0,4 minuto** antes da consulta. O registro persistente voltou a avançar após o novo deploy.
- O commit `9eaba4d` com documentação também foi publicado como **live** em `2026-11-24T16:41:25Z` e seu workflow CI terminou com sucesso.
- A última atualização exclusivamente documental não muda decisões, risco ou estratégias. Sua publicação pode estar em andamento durante a gravação deste registro.
- Observação: o progresso após o deploy confirma uma retomada pontual, **não 24/7**. O plano Render free pode suspender o processo novamente após inatividade.


## 13. Diagnóstico do NOVA por exposição — 2026-11-24

**Observação confirmada no Supabase** em `2026-11-24T19:17:59Z`: último estado paper persistido `2026-11-24T17:55:44Z`, atraso 82,3 minutos. Última decisão ETHUSDT/NOVA: `WAIT`, `CAPITAL_OR_RISK_LIMIT`, EMA9 1680,64 > EMA21 1678,86, RSI14 52,45, posição ETH ausente. Havia posição BTC aberta com notional de entrada ~US$ 4.917, próxima/acima do limite de exposição máximo de 50% do patrimônio paper; não havia folga para uma compra ETH de US$ 10. Portanto, para essa decisão o motivo específico foi **limite de exposição**, não um erro técnico, nem falta de sinal. Não abrir posição só para melhorar estatísticas.

**Implementado sem mudar execução ou regras de risco**:
- `79cf99b`: exporta classificador informativo `classifyPaperEntryBlock` e salva gates `portfolioExposureAvailable` e `exposureRemainingUsdt` para novas decisões.
- `bb6562c`: traduz `PORTFOLIO_EXPOSURE_LIMIT` no diagnóstico por robô.
- `b6fd5fd`: mostra razão específica e gate de exposição na interface, com `Não avaliada` para decisões históricas anteriores à implementação.
- `164e2f0`: teste para evitar confundir bloqueio de exposição com orçamento geral e confirmar que o classificador não cria ordens.
- A suíte de testes e o deploy mais recentes devem ser conferidos antes de declarar a atualização em produção.

**Limitação operacional**: serviço web Render plano gratuito pode suspender, causando lacunas de candles. Não afirmar disponibilidade 24h; não habilitar trading real nem contratar serviços.


## 14. Auditoria de estabilidade — 24/11/2026 (18:09 Brasília)

**Estado da infraestrutura na consulta:** Render `trading-agent` mostrou deploy `755549151` como `live`, plano `free` mantido, autodeploy no branch `trading-agent-v2`. No Supabase às `2026-11-24T21:09:58Z`, o último snapshot persistido foi `2026-11-24T19:30:46Z`, com atraso de **99,2 minutos** e `lastError={}`. Isto mostra que o processo não está registrando candles a cada cinco minutos enquanto inativo. A hibernação do serviço free é uma explicação provável, mas a leitura do banco sozinha não demonstra a causa.

**NOVA:** última decisão na mesma consulta foi `WAIT` / `EMA_TREND_NOT_BULLISH`, RSI `44.99`; o motivo da última decisão pode mudar a cada candle. A detecção de bloqueio por exposição implementada em commits anteriores permanece válida para o caso anterior; não apresentar como razão permanente do robô.

**Correção desta etapa, sem alterar trading, taxas nem risco:**
- Commit `f7c03ac`: `/api/agent-diagnostics` passa a expor `collectionHealth` com `CURRENT`, `STALE`, `ERROR`, `INSUFFICIENT_DATA` ou `PARTIAL`, `allCurrent` e `lastCandleCloseAt`.
- Commit `0258ff7`: testes de regressão da classificação agregada.
- Commit `cf040166`: sala dos robôs apresenta aviso `collectorWarning` de coleta atrasada, falta de dados, falhas e ausência de garantia de execução 24h no plano gratuito.
- Commit `754be50`: teste automatizado do aviso visual e semântica acessível.
- **Publicação/testes**: verificar o último workflow GitHub e o último deploy Render; estavam em andamento na consulta inicial. Não registrar sucesso até confirmar.

**Pendência estrutural:** a coleta paper baseada no timer do processo web Render free não é 24/7. Não usar pings artificiais para simular produção contínua. Alternativas futuras dependem de uma mudança explícita de infraestrutura/custos ou arquitetura de coleta dirigida por eventos, sem retrocriar candles perdidos.


## 15. Continuidade segura após hibernação — 24/11/2026

**Problema real:** a aplicação web gratuita no Render pode parar de executar timers e perder várias velas de cinco minutos. Antes desta mudança o motor `processCandle` podia avançar diretamente do último candle antigo para o mais recente, ocultando o intervalo não observado e simulando execução sem histórico completo.

**Implementação no branch `trading-agent-v2`:**
- `66ead5f` em `trading-v2/paper.js`: ao detectar salto maior que um intervalo de 5 minutos por mercado, grava `dataGaps` no snapshot persistido e toma uma decisão `WAIT` (sem compra ou venda simulada) na primeira vela da retomada. Se há posição virtual aberta, grava `gapLocks` e mantém a posição em quarentena nas próximas velas, evitando preenchimentos hipotéticos de stop e alvo para períodos não observados. Preserva capital, trades e versão de esquema `schema:1`, com compatibilidade retroativa de estados antigos.
- `9eba00c`: testes de lacuna, não preenchimento fictício, trava persistente entre reinícios e migração retrocompatível.
- `c62c362`: `/api/agent-diagnostics` informa `gapLocked`, `lastGap`, estado `LACUNA_HISTORICA` e saúde agregada `GAP_LOCK`; coleta de fato atrasada continua priorizada como `STALE`.
- `3a5fcc2`: testes do diagnóstico de quarentena.
- `a5139f6`: sala visual exibe aviso específico, motivo `DATA_GAP_POSITION_LOCK` e risco de intervalos perdidos.
- `14eb6d3`: teste da apresentação do bloqueio.
- `1c36d75`: explica os limites no README e a necessidade de reconciliação antes de retirar a trava.

**Testes comprovados:** GitHub Actions `45489008161`, commit `14eb6d34c41c725929fb27e4e0e44a1bcda35e55`: **147 testes aprovados, 0 falhas, 0 ignorados**, com validação de sintaxe. Link: https://github.com/wallissonghost-code/trading-agent/actions/runs/45489008161 . As alterações posteriores a esse commit são documentais; devem ter seu deploy final confirmado no Render.

**Atenção para a operação:** trancar uma posição virtual cuja trajetória não foi totalmente observada é uma escolha conservadora e deliberada. Não desbloquear, eliminar ou liquidar a posição sem definir procedimento de reconciliação. Os dados históricos e a carteira persistente não são resetados. Este mecanismo não restaura candles nem cria simulações retrospectivas de execução.

**Pendência de infraestrutura:** plano Render gratuito continua sujeito à hibernação; a proteção de lacunas não garante execução 24/7. É necessário consultar status de deploy e logs antes de afirmar estabilidade da última versão.


## 16. Auditoria de reconciliação de lacunas — 24/11/2026

**Objetivo:** permitir revisão segura de posições virtuais em quarentena por ausência de candles, sem criar saídas retrospectivas ou alterar ordens.

**Código implementado**
- `trading-v2/gap-reconciliation.js` (`b1ffd450`): função pura `inspectGapReconciliation` valida continuidade de candles Binance Spot de 5 minutos desde o último candle registrado antes da lacuna até o último candle paper. Retorna `MANUAL_REVIEW_REQUIRED`, `HISTORY_INCOMPLETE`, `INSUFFICIENT_EVIDENCE` ou `NO_QUARANTINE`, e classifica primeiro possível toque em stop, alvo ou ambos na mesma vela. **Um toque não comprova ordem executada nem permite desbloqueio**.
- `trading-v2/gap-reconciliation.test.js` (`c0a95b66`): testes de cobertura completa/incompleta, dados inválidos/duplicados, ambiguidade de OHLC, ausência de autorização e imutabilidade do estado.
- `trading-v2/server.js` (`e7df26cc`): rota `GET /api/gap-reconciliation`, consulta até 1000 candles públicos somente para ativos com `gapLocks=true`, nunca altera carteira, não requer credenciais de exchange e não possui POST de desbloqueio.
- `trading-v2/index.html` (`f9632638`): aviso de auditoria no painel quando houver quarentena; mostra a classificação sem permitir liberação da posição.
- `trading-v2/agent-diagnostics.api.test.js` (`bee34afa`): teste HTTP do endpoint de auditoria sem trava.
- `trading-v2/ui.test.js` (`529cad93`): confirma avisos de somente leitura.
- `trading-v2/README.md` (`31c482e2`): descreve limites e critérios da auditoria.

**Testes confirmados:** GitHub Actions run `45490486702` no commit `529cad93`, **157 aprovados, zero falhas, zero ignorados**. Link https://github.com/wallissonghost-code/trading-agent/actions/runs/45490486702.

**Deploy:** Render informou commit `f9632638` como `live` em `2026-11-24T21:22:53Z`, contendo módulo, API e interface. Commits posteriores eram testes/documentação e a publicação final deve ser verificada separadamente. Não houve mudança do plano gratuito.

**Estado observado do Supabase:** em `2026-11-24T21:23:18Z`, `trading_paper_states.updated_at=2026-11-24T21:20:03Z`, com `gapLocks={}`, `dataGaps={}` e posição BTCUSDT virtual ainda aberta. Não havia quarentena ativa para avaliar nesse instante. Nunca mutar dados para simular ocorrência de lacuna em produção.

**Limites:** nenhum método automatizado de reconciliação efetiva/desbloqueio foi autorizado ou implementado. Evidências OHLC não revelam a ordem intravela e não podem ser tratadas como fills reais. A implantação do Render free pode dormir, o que requer monitoramento honesto e eventual infraestrutura apropriada para coleta contínua.


## 17. Procedimento administrativo sem mutação — 24/11/2026

**Situação observada:** o Render confirmou commit `ef2c632c` como `live`. Supabase às `2026-11-24T21:27:29Z` mostrou `gapLocks={}`, `dataGaps={}` e posição virtual BTCUSDT existente. Nenhuma liquidação/desbloqueio foi feita.

**Código desenvolvido na branch `trading-agent-v2`:**
- `trading-v2/gap-review-plan.js` (`eb4c3e3`): gera dossiê de revisão administrativa somente leitura para cada ativo, com hash SHA-256 das evidências da posição, lacuna, decisão e análise de candles. Estados: `NO_ACTIVE_CASE`, `EVIDENCE_INCOMPLETE`, `AMBIGUOUS_MANUAL_REVIEW`, `MANUAL_REVIEW_READY`. Mesmo `MANUAL_REVIEW_READY` **não** autoriza destravar ou contabilizar um trade.
- `trading-v2/gap-review-plan.test.js` (`7379eaf`): testes para hash estável, detecção de mudança do snapshot, incerteza OHLC, ausência de autoridade financeira e não mutação.
- `trading-v2/server.js` (`8d14cee`): acrescenta `administrativeReview` ao relatório `GET /api/gap-reconciliation`, aproveitando os candles já consultados, sem novo endpoint mutável.
- `trading-v2/index.html` (`cf89469`): exibe identificação do dossiê e motivo de revisão humana, sem botões de aprovação.
- Testes HTTP/UI em `5b0d93e`, `1b2efda`, `0b5514e`. O teste UI inicial falhou por expressão de busca incorreta e foi corrigido em `0b5514e`.
- `trading-v2/README.md` (`60099e3`): documentação do procedimento e pré-requisitos de autorização, controle de concorrência e auditoria para eventual implementação futura.

**Testes verificados:** GitHub Actions run `45491492524` no commit `0b5514e` passou **165/165 testes, 0 falhas e 0 ignorados**, incluindo validação de sintaxe. Link https://github.com/wallissonghost-code/trading-agent/actions/runs/45491492524. Verificar novamente a última publicação no Render, pois `60099e3` é posterior (somente documentação).

**Segurança:** nenhuma opção de aprovação/POST de desbloqueio existe, e nenhuma alteração foi feita nas posições reais ou virtuais do banco. A autorização para projeto/trabalho não é autorização para liquidar uma posição em quarentena com premissas de execução não verificáveis. Uma futura mutação exige autenticação administrativa real, confirmação caso a caso, hash de estado conferido e ledger append-only transacional.


## 18. Isolamento e autenticação da revisão administrativa — 24/11/2026

**Diagnóstico de segurança:** a rota pública `GET /api/gap-reconciliation` incluía `administrativeReview`, com detalhes de posição, evidências e hashes que pertencem ao fluxo restrito. Foi removido esse acoplamento: o relatório público agora contém apenas o resultado read-only da auditoria de candles.

**Implementação**
- `trading-v2/admin-access.js`, commit `ab5db91`: verificação de `Authorization: Bearer` com comparação de digest SHA-256 em tempo constante. Sem `ADMIN_REVIEW_TOKEN` de pelo menos 32 caracteres, acesso indisponível (fail-closed). Nunca registra ou retorna token.
- `trading-v2/admin-access.test.js`, commit `10c8a18`: credencial correta/incorreta, ausência de configuração e não divulgação.
- `trading-v2/server.js`, commit `9bfda91`: separa `/api/gap-reconciliation` (público, sem dossier administrativo) de `GET /api/admin/gap-review` (restrito). Responde HTTP 503 sem configuração ou HTTP 401 com token inválido; método POST continua 405. Nenhum método altera posição, ledger ou `gapLocks`.
- `trading-v2/index.html`, commit `a3f6369`: painel público não mostra mais `caseId` nem `evidenceSha256`; apenas indica que o dossiê detalhado é restrito.
- `trading-v2/server.js`, commit `6d6c8fd`: log de acesso administrativo com horário, rota e status de autorização; sem credencial, IP, cabeçalhos ou dados privados. **Esse log operacional Render não é ledger append-only durável**.
- Testes ajustados `b28eaf7`, `e92f5c3`, `70f3111`: reforçam o isolamento público/restrito e autenticação HTTP. Falhas intermediárias do CI ocorreram porque testes antigos ainda esperavam `administrativeReview` na API pública. Corrigidos e suite aprovada.
- `trading-v2/README.md`, commit `f235be3`: documenta variável `ADMIN_REVIEW_TOKEN`, regras, acesso sem custo e limite da auditoria atual.

**Evidência de testes:** GitHub Actions run `45493482992` no commit `70f3111`: **169 testes, 169 aprovados, 0 falhas/ignorados**. Link: https://github.com/wallissonghost-code/trading-agent/actions/runs/45493482992.

**Segurança operacional:** não foi gerada credencial administrativa nem definida `ADMIN_REVIEW_TOKEN` no Render. Por padrão, a rota de administração permanece indisponível; não publicar o segredo no frontend/GitHub/URLs. Para uso futuro, gerar segredo forte e instalar somente no servidor, preferencialmente com autenticação multiusuário e auditoria durável. Não há desbloqueio, liquidação, ordens reais ou autorização financeira.

**Verificação de deploy:** checar o commit de produção mais recente após essas alterações. O CI da versão testada passou; resultado de deploy deve ser reportado separadamente.


## 19. Supabase audit e custo Render — 24/11/2026

**Solicitação:** avançar com trilha persistente de acesso administrativo e pesquisar custo para os robôs rodarem automaticamente. **Nenhuma compra/upgrade foi autorizada ou feita**.

**Banco Supabase (projeto `trading-agent`, ref `ieaqsfotzsnwjqtppgfd`)**
- Arquivos SQL versionados: `trading-v2/sql/admin-audit-schema.sql` (`ba76f02`) e `trading-v2/sql/admin-audit-log-route.sql` (`59037e4`).
- Migrações reais aplicadas com sucesso: `trading_admin_access_audit_20261124`, `trading_admin_audit_log_route_20261124`.
- Nova tabela `public.trading_admin_access_audit`: `id`, `portfolio_id`, `event_type`, `outcome`, `route`, `occurred_at`; sem tokens, IP, posições ou PnL.
- RLS ativa, sem políticas para `anon`/`authenticated`; privilégios públicos explicitamente revogados. `service_role` pode `SELECT`/`INSERT` mas não `UPDATE`/`DELETE`; gatilhos bloqueiam UPDATE, DELETE e TRUNCATE. Não descrever como criptograficamente inviolável, pois administradores privilegiados continuam controlando a base.
- Verificação SQL confirmou `anon_read=false`, `authenticated_read=false`, `service_insert=true`, `service_read=true`, `service_update=false`, `service_delete=false`, e gatilhos habilitados. O advisor Supabase sinalizou `rls_enabled_no_policy` (INFO); intencional para tabela exclusivamente de serviço, link https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy .
- `trading-v2/supabase-store.js` (`205f882`): `appendAdminReviewAccess` e `listAdminReviewAccess` restritos ao backend.
- `trading-v2/server.js` (`de2f680`): grava tentativa administrativa no Supabase. Mesmo com token correto, `/api/admin/gap-review` devolve HTTP 503 caso a gravação durável falhe; nova rota protegida `GET /api/admin/audit-log` consulta últimos eventos após registrar sua própria autorização. Credencial de admin `ADMIN_REVIEW_TOKEN` permanece **não configurada**.
- Testes novos de fail-closed sem persistência em `7107239`, de adaptador em `5b24766`; um CI intermediário falhou antes do ajuste de expectativa, corrigido depois. Workflow run `45494262385` passou **171 de 171 testes**. Link https://github.com/wallissonghost-code/trading-agent/actions/runs/45494262385 .
- Documentação completa em `trading-v2/README.md` (commit `6190ccb`).

**Render e preços checados em 24/11/2026**
- Serviço existente: `trading-agent`, workspace autorizado `My Workspace`, **plano de instância `free`** (não houve mudança).
- O `free` hiberna depois de **15 minutos sem tráfego**; ciclos de trading paper em memória ficam suspensos.
- Render Web Service Starter (ID atual `0.5c-512mb`, nome legado `starter`): **US$ 7/mês** por 1 instância, **0,5 CPU e 512 MB RAM**, não hiberna por inatividade. Cobrança proporcional por segundo do plano de compute; custos adicionais de banda/serviços/impostos podem existir. Plano do workspace separado do de compute. Fontes: https://render.com/pricing https://render.com/docs/free https://render.com/docs/compute-plans .
- Memória observada nas amostras do serviço pelo Render foi inferior a aproximadamente **170 MB**, sugerindo que 512 MB pode bastar inicialmente; CPU/carga e continuidade real precisam ser medidas em execução prolongada.
- Referência cambial de 24/11/2026 BCB PTAX ~R$ 5,857 por dólar indica base de cerca de **R$ 41/mês** antes de IOF, spread ou taxas e variação cambial; é estimativa, não cobrança confirmada.
- Não contratar sem autorização expressa para o valor e aceitar que Starter evita idle sleep, mas não garante 100% de uptime.

**Próxima etapa:** validar último deploy e saúde dos dados; decidir upgrade somente se o usuário autorizar o custo explicitamente. Implementar eventual painel administrativo com autenticação multiusuário e auditoria transacional antes de qualquer ação de mutação.


## 20. Proteção contra candles incompletos e marcas não persistidas — 24/11/2026

**Contexto:** o plano Render Free permanece em uso, sujeito à hibernação. Consulta Supabase `2026-11-24T22:01:28Z` mostrou snapshot atualizado há menos de um minuto, `gapLocks={}`, `dataGaps={}`, `lastError={}` e posição paper BTCUSDT ainda aberta. Não iniciar ordem real ou contratar hospedagem.

**Implementação concluída**
- Commit `ff6e16d` em `trading-v2/paper.js`: nova função `assertPaperCandleContinuity` recusa janela irregular dos últimos 35 candles com validação de OHLC, timestamps e incrementos exatos de cinco minutos. É aplicada antes da primeira mutação da conta e antes de avaliar a estratégia, impedindo operações sobre feed parcial não identificado. A diferença entre o último candle persistido e a próxima janela válida permanece sujeita aos bloqueios de lacuna já existentes.
- Mesmo commit: o runner só atualiza `quotes[symbol]` **depois** de validar a vela e confirmar a gravação necessária. Erros de persistência restauram estado anterior e preservam o preço confirmado na exposição de patrimônio.
- Commit `4364df3` em `trading-v2/paper.test.js`: testes adicionais de candles internos ausentes, OHLC inválido, intervalos adulterados, sequência correta e rollback de preços sem gravação durável. CI run `45496937200` confirmou **175 testes aprovados, zero falhas, zero ignorados**: https://github.com/wallissonghost-code/trading-agent/actions/runs/45496937200 .
- Commit `07d7f3f` atualiza `trading-v2/README.md` com o comportamento fail-closed.

**Publicação:** Render confirmou `ff6e16d` como `live` em `2026-11-24T22:02:16Z`; a publicação mais nova `4364df3` (somente testes) ainda estava em build e `07d7f3f` (somente documentação) estava enfileirada na primeira consulta. Confirmar o último deploy após o fim da fila.

**Limites:** exigência de 35 candles consecutivos pode interromper decisões quando o feed de mercado tem buracos; é deliberado para impedir resultados artificiais. Não preenche dados retrospectivamente, não impede o Render Free de dormir, não modifica regras de risco e não garante rentabilidade.


## 21. Diagnóstico de qualidade dos testes paper — 24/11/2026

**Meta:** distinguir evidências de funcionamento da carteira paper das observações independentes dos estudos shadow, evitando confundir histórico recebido com execução virtual real.

**Implementação (branch `trading-agent-v2`)**
- `ffcf4b8`: novo módulo `trading-v2/paper-evidence.js`. Reúne estado persistido do motor paper (último candle por ativo, frescor, erros, posições, `gapLocks`, última lacuna), amostras recentes de trades e cobertura **independente** do coletor shadow 6h/24h. Detecta falta de evidência histórica, coleta atrasada e lacunas sem inferir uptime do Render. O diagnóstico não altera carteira, não habilita ordens reais, não compra hosting, nunca promove automaticamente estratégias.
- `9ab35ff`: `trading-v2/paper-evidence.test.js` com 6 testes de integridade, indicadores incompletos, imutabilidade, diferença shadow versus paper e bloqueio de promoção.
- `2f3d26b`: nova rota de leitura `GET /api/paper-evidence`, que consulta os relatórios existentes `getMonitoringTimeline()` e `getMonitoringCoverage()` e usa `paper.status()`, sem gravar observações falsas.
- `fa3b9e6`: seção recolhível no painel **Qualidade do teste dos robôs • PAPER**, com cards por robô, últimos candles e ressalvas; atualiza quando a aba é aberta.
- `7907a42`, `8a840bb`: testes de API e UI; `2ece0da` atualiza `navigation.test.js` para incluir o carregamento do novo diagnóstico. Houve falhas transitórias de CI devido à asserção de navegação antiga; todas corrigidas.
- `63713aa`: documentação do significado e limites dos novos indicadores no README.

**Evidência de testes:** CI run `45512566327` commit `2ece0da`: **182/182 testes passaram**, 0 falhas/ignorados, incluindo validação JS. URL https://github.com/wallissonghost-code/trading-agent/actions/runs/45512566327 .

**Deploy confirmado:** Render `srv-dc28e4uc6qcc73eq0940` recebeu `2ece0da` como `live` em `2026-11-24T23:45:37Z`. O commit `63713aa` é somente documentação e estava em build no momento da consulta; conferir versão posterior se necessário. O plano de instância permanece **free**, sem contratação.

**Limite principal:** a cobertura shadow não prova uptime do paper. Ainda não existe um diário paper com 7 dias completos de slots auditados; por isso o diagnóstico **não declara o projeto pronto para trading real nem justifica automaticamente a migração para US$ 7**. Próximo aperfeiçoamento: coletar e persistir slots reais do próprio motor paper, com tratamento de reinícios e lacunas, sem backfill retroativo.


**Ocorrência de operação após deploy — 24/11/2026 23:46 UTC:** consulta ao Supabase confirmou `gapLocks.BTCUSDT=true`, `dataGaps.BTCUSDT.missedCandles=16`, detecção `2026-11-24T23:44:21.602Z`, último motivo `DATA_GAP_POSITION_LOCK`; posição virtual BTCUSDT continua intacta. A diferença entre o último candle antigo (`1795558499999`) e o candle de retomada (`1795563599999`) levou à quarentena. **Não comprova a causa da interrupção**: pode ser suspensão/redeploy/coleta. Não reconstituir trades, não alterar posições ou desbloquear; esta ocorrência reforça a necessidade de revisão histórica e instrumentação própria paper.
