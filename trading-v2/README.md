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

## Testes

`npm test` executa arquivos `*.test.js` usando o test runner do Node. Um workflow de GitHub Actions está disponível em `.github/workflows/trading-agent-v2.yml`; consultar o resultado da execução, não presumir sucesso só pela existência do arquivo.

Os critérios de aceitação estão em [DIAGNOSTICOS_CRITERIOS.md](DIAGNOSTICOS_CRITERIOS.md). A continuidade do projeto e as limitações verificadas ficam em [CONTINUIDADE_PROJETO.md](../CONTINUIDADE_PROJETO.md).

## Segurança

- Este código permanece somente em modo paper, observação e pesquisa; não contém envio de ordens reais.
- Não acrescentar autorização de trading real sem pedido específico e validação separada.
- Não mostrar preços sintéticos como cotações reais nem PnL fictício como saldo de corretora.
- Não declarar 24/7 sem confirmação da infraestrutura, logs e persistência.
