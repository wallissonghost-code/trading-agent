# Trading Agent V2 — Sala de comando (paper trading)

Este diretório contém o servidor Node.js, a interface web e os módulos de análise/monitoramento do **Trading Agent V2**. Código da branch `trading-agent-v2`; não confundir com o projeto FUT Live da branch `main`.

## Executar

Requisitos: Node.js 20+.

```bash
cd trading-v2
npm test
npm start
```

Abrir `http://localhost:3000`. Pode ajustar a porta com `PORT`.

## Modos e fontes de dados

| API | Fonte / propósito | Executa ordens reais? |
| --- | --- | --- |
| `GET /health` | Verificação do processo Node | Não |
| `GET /api/status`, `/api/agents`, `/api/market`, `/api/analysis` | **Dados sintéticos demonstrativos** | Não |
| `GET /api/paper` | Posições, resultados e decisões da carteira **virtual** | Não |
| `GET /api/agent-diagnostics` | Diagnóstico por robô derivado de `/api/paper` | Não |
| `GET /api/market-live`, `/api/analysis-live` | Candles públicos Binance Spot, somente leitura | Não |
| `GET /api/prospective-screens` | Estudo prospectivo; amostra e resultados não são operações | Não |
| `GET /api/monitor-health` | Saúde e cobertura do monitoramento de pesquisa | Não |

O diagnóstico `/api/agent-diagnostics` mostra ALPHA/BTCUSDT, NOVA/ETHUSDT e ORION/SOLUSDT. Os estados `OPERANDO`, `AGUARDANDO_SINAL`, `COLETA_ATRASADA`, `ERRO` e `SEM_DADOS` são inferidos de fatos do motor paper. Os estados de espera de candle e avaliação pendente pertencem ao **estudo prospectivo**, não significam uma ordem aberta.

A carteira paper possui limites de exposição, risco e quantidade de posições. Suas entradas/saídas são **preenchimentos fictícios** baseados em candles fechados; não equivalem a ordens efetivamente negociadas. Nenhuma estratégia promete retorno.

## Persistência e hospedagem

Por padrão, o motor paper usa um arquivo local (`PAPER_STATE_PATH` ou `/tmp/trading-agent-paper.json`). Esse estado pode desaparecer em hospedagens com disco efêmero.

Para persistência externa, o código requer `SUPABASE_URL` e **uma** das variáveis `SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`, além da configuração de esquema/permissões correspondente. **Nunca armazene os valores no repositório.** As variáveis são nomes de configuração, não instruções para divulgá-las publicamente.

A aplicação depende de um processo Node persistente para ciclos periódicos; uma hospedagem serverless de páginas estáticas **não substitui** esse serviço. **Limite de disponibilidade:** o serviço confirmado no Render está no plano `free`. Segundo a documentação do Render, instâncias web gratuitas entram em suspensão após 15 minutos sem tráfego recebido; os ciclos em memória deixam de rodar nesse intervalo. O banco Supabase preserva o que já foi gravado, mas não recria candles e decisões que o processo não coletou. Este projeto não garante monitoramento 24/7 no plano gratuito. Não usar mecanismos de tráfego artificial como substituto de uma arquitetura de processamento contínuo.

O status de um **outro projeto** no Vercel não comprova deploy deste servidor. Verifique a URL real do Render e os endpoints `/health`, `/api/paper` e `/api/agent-diagnostics` antes de declarar publicação bem-sucedida.

## Continuidade de candles e lacunas (5 minutos)

O papel de `trading-v2/paper.js` é **não inventar execuções enquanto o Render estiver suspenso**. O motor compara o último candle fechado persistido de cada ativo com o candle recebido e grava `dataGaps[symbol]` com `missedCandles`, horários e a indicação de posição pendente. Esses dados fazem parte do mesmo snapshot persistente no Supabase (ou no arquivo local).

- **Sem posição virtual aberta:** a primeira vela após uma lacuna recebe decisão `WAIT / DATA_GAP_RESUMED`, não gera ordem simulada e a observação normal pode continuar nas velas seguintes.
- **Com posição virtual aberta:** a posição é preservada e marcada `gapLocks[symbol]=true`, com decisão `WAIT / DATA_GAP_POSITION_LOCK`. O bloqueio sobrevive a reinícios. Não se executam saídas ou novas entradas fictícias nessa posição, pois stops/targets podem ter ocorrido durante o intervalo não observado.
- O painel expõe `LACUNA_HISTORICA` e o último incidente sem reinterpretar candles passados como transações.
- **Reconciliação:** neste estágio não há botão automático para desbloquear. Uma posição com `gapLocks` exige revisão específica do histórico e uma política segura de retomada antes de qualquer mutação; não apagar a trava manualmente em produção sem avaliar a posição preservada. O histórico existente continua intacto.
- Essa proteção **não substitui coleta 24/7** e não reconstitui ordens perdidas. O motor continua restrito a paper trading, com execução financeira real desativada.

## Auditoria de reconciliação — somente leitura

A rota `GET /api/gap-reconciliation` produz um relatório de evidências para **posições virtuais bloqueadas** por lacunas de candles. Sem posição em quarentena, retorna `NO_QUARANTINE` sem consultar dados externos. Para cada posição bloqueada, consulta até 1000 candles públicos de 5 minutos da Binance Spot e compara a sequência com o último candle persistido antes da lacuna.

Os possíveis resultados incluem `MANUAL_REVIEW_REQUIRED` (OHLC contínuo disponível), `HISTORY_INCOMPLETE`, `INSUFFICIENT_EVIDENCE` e `MARKET_DATA_UNAVAILABLE`. A auditoria indica possíveis toques em stop ou alvo; quando ambos aparecem na mesma vela, informa `BOTH_IN_SAME_CANDLE`, pois os candles OHLC **não revelam a ordem intravela**. Mesmo com histórico completo, um toque não é uma ordem executada.

Essa API não tem métodos de alteração da carteira, não liquida operações, não modifica histórico, não desbloqueia `gapLocks` e não atribui resultado financeiro a eventos não observados. O painel mostra apenas o parecer; a posição permanece bloqueada até que exista um processo de reconciliação administrativa separado, autorizado e auditado. Essa funcionalidade não soluciona a hibernação do serviço gratuito.


## Processo administrativo para posições paper em quarentena

A auditoria pública `GET /api/gap-reconciliation` **não expõe dossiês administrativos**. A rota separada `GET /api/admin/gap-review` inclui `administrativeReview` com um dossiê por robô, somente mediante uma credencial administrativa configurada no servidor. Cada dossiê contém uma identificação `caseId`, impressão digital SHA-256 das evidências `evidenceSha256`, snapshot da posição, lacuna, última decisão e resultado do exame OHLC. O hash serve para reconhecer quando o pacote de evidências muda; **não é assinatura digital, nem comprovação de autoria, nem autorização**.

O estado administrativo pode ser `NO_ACTIVE_CASE`, `EVIDENCE_INCOMPLETE`, `AMBIGUOUS_MANUAL_REVIEW` ou `MANUAL_REVIEW_READY`. O último indica apenas que há evidências para análise humana, **nunca autorização para desbloquear**. O painel mostra o número do dossiê quando houver quarentena.

A rota administrativa exige o cabeçalho `Authorization: Bearer <token>`, com token aleatório de pelo menos 32 caracteres definido exclusivamente na variável de servidor `ADMIN_REVIEW_TOKEN`. **Sem essa variável, a rota responde HTTP 503 e permanece indisponível**; com credencial inválida, HTTP 401. Não adicionar esse segredo ao JavaScript do painel, ao GitHub, a URLs ou a arquivos compartilhados. A API pública permanece utilizável sem token e não contém `administrativeReview`. O servidor registra apenas horário, rota e resultado da autorização nos logs do Render, sem token, endereço IP nem detalhes da carteira. Esses logs são rastros operacionais e **não substituem um ledger append-only durável**. Nenhuma credencial foi criada ou ativada no Render durante esta etapa.

O processo para uma futura resolução operacional exige, em etapa separada, autenticação com privilégio administrativo, confirmação explícita da decisão por caso, comparação com o hash atual do estado persistido, registro append-only da identidade/motivo/data/ações e mecanismo transacional de atualização do ledger e da posição. Essa etapa de mutação **não foi implementada nem habilitada**. Até lá, a posição continua preservada e o motor continua bloqueado quando `gapLocks` estiver ativo. Não executar SQL direto para apagar bloqueios e não inventar preenchimentos retroativos.

## Auditoria administrativa persistente no Supabase

O esquema SQL versionado fica em `sql/admin-audit-schema.sql` e `sql/admin-audit-log-route.sql`, aplicado ao projeto Supabase `trading-agent`. A tabela `public.trading_admin_access_audit` grava somente `portfolio_id`, tipo de evento, rota, resultado de autorização e horário gerado pelo banco. **Não** registra tokens, cabeçalhos de autorização, IP, informações pessoais ou posições financeiras.

- A tabela tem RLS habilitada, acesso anônimo e de usuários autenticados comuns revogado, e `service_role` com apenas `SELECT` e `INSERT`. Gatilhos bloqueiam UPDATE/DELETE/TRUNCATE, inclusive por tentativas de alteração de registros históricos. Administradores privilegiados do banco ainda podem alterar a estrutura: isto é um **registro operacional append-only com resistência à edição**, não armazenamento criptograficamente imutável.
- Tentativas ao endpoint `GET /api/admin/gap-review` são registradas antes de liberar o dossiê. Com token válido, mas sem confirmação de gravação no Supabase, o endpoint responde 503 (`AUDIT_UNAVAILABLE`), sem mostrar dados administrativos. Acesso com token errado responde 401; sem token configurado retorna 503.
- `GET /api/admin/audit-log` também exige o token administrativo e gera seu próprio registro antes de listar os eventos mais recentes (máximo de 50). Não existe endpoint de apagar, editar ou desbloquear.
- A credencial `ADMIN_REVIEW_TOKEN` **não foi configurada no Render** e o acesso restrito permanece fechado. Quando houver decisão explícita de ativação, instalar segredo aleatório forte somente no ambiente de servidor, fora do GitHub e do painel.
- Retenção, identificação individual de operadores e aprovação de liquidação ainda exigem soluções próprias; não afirmar conformidade regulatória ou trilha inviolável baseada apenas nessa tabela.

## Render — custo para execução sem hibernação

Em 24/11/2026, o primeiro plano pago de Web Service do Render é o **Starter** (ID atual `0.5c-512mb`), **US$ 7/mês** com 0,5 CPU e 512 MB de RAM. O plano `free` pode suspender após 15 minutos sem tráfego HTTP/WebSocket recebido, interrompendo os ciclos de coleta. O Starter não suspende por inatividade; pode reiniciar em atualizações/falhas e não oferece garantia de coleta sem falhas. Os preços são cobrados proporcionalmente ao uso do serviço, com possíveis custos adicionais de consumo/banda e impostos; confirmar no checkout antes de contratar. O plano do workspace é diferente do plano de computação do serviço.

O serviço `trading-agent` **permaneceu em `free`**: nenhum upgrade ou autorização de cobrança foi aplicado. A memória observada em amostras recentes do Render ficou abaixo de 170 MB, portanto 512 MB parece um ponto inicial razoável, sujeito à validação de carga contínua. Fontes: https://render.com/pricing e https://render.com/docs/free e https://render.com/docs/compute-plans.

## Testes

`npm test` executa arquivos `*.test.js` usando o test runner do Node. Um workflow de GitHub Actions está disponível em `.github/workflows/trading-agent-v2.yml`; consultar o resultado da execução, não presumir sucesso só pela existência do arquivo.

Os critérios de aceitação estão em [DIAGNOSTICOS_CRITERIOS.md](DIAGNOSTICOS_CRITERIOS.md). A continuidade do projeto e as limitações verificadas ficam em [CONTINUIDADE_PROJETO.md](../CONTINUIDADE_PROJETO.md).

## Segurança

- Este código permanece somente em modo paper, observação e pesquisa; não contém envio de ordens reais.
- Não acrescentar autorização de trading real sem pedido específico e validação separada.
- Não mostrar preços sintéticos como cotações reais nem PnL fictício como saldo de corretora.
- Não declarar 24/7 sem confirmação da infraestrutura, logs e persistência.
