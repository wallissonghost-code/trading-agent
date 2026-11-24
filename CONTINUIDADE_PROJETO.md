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
