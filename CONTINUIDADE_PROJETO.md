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
