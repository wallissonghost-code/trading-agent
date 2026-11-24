# Trading Agent V2 — Critérios de diagnóstico e validação

Este documento define os próximos testes de aceitação. Não representa resultados de testes executados.

## Estados distintos por robô
- **OPERANDO (paper):** há uma operação simulada aberta, identificada por ordem e horário.
- **AGUARDANDO_SINAL:** coleta recente e íntegra; nenhuma estratégia elegível.
- **AGUARDANDO_CANDLE:** sinal observado, aguardando fechamento do candle necessário para avaliação.
- **COLETA_ATRASADA:** último candle excede o limite de atraso configurado.
- **AVALIACAO_PENDENTE:** candle de resultado disponível, apuração ainda não concluída.
- **ERRO:** falha verificável de API, persistência ou processamento.
- **SEM_DADOS:** observações insuficientes para classificar.
- **PAUSADO:** desativação explícita pelo operador.

## Regras de apresentação
1. Nunca apresentar AGUARDANDO_SINAL como falha nem como operação executada.
2. Exibir por ALPHA/BTC, NOVA/ETH e ORION/SOL: estado, motivo, horário da última coleta, último sinal, último resultado, tempo desde a atualização e fonte.
3. Distinguir dados reais de mercado, simulações e métricas históricas. Lucro de paper trading nunca deve ser identificado como saldo real.
4. Quando a API estiver indisponível, mostrar dado desatualizado e horário da última resposta, não valores fictícios.
5. Exibir fuso horário e evitar atualizar a data de coleta somente porque o painel fez polling.
6. Dados insuficientes devem aparecer como “não validado”, sem alegações de aprendizagem ou rentabilidade comprovada.

## Casos de teste a implementar
- Sem candles: SEM_DADOS.
- Candles recentes sem sinal: AGUARDANDO_SINAL.
- Sinal com candle de resultado futuro: AGUARDANDO_CANDLE.
- Candle de resultado recebido e avaliação ausente: AVALIACAO_PENDENTE.
- Atraso de coleta: COLETA_ATRASADA, com limite configurável.
- Falha HTTP/timeout: ERRO com mensagem segura e tentativa posterior.
- Operação paper aberta: OPERANDO, sem confundir PnL não realizado com realizado.
- Recarregamento da página: estado derivado da API, não de contador local.
- Mobile: abas acessíveis e sem rolagem horizontal indevida.
- Cada estado deve ter teste de regressão; validar sem credenciais reais.

## Critérios de segurança
- Permanecer em paper/testnet por padrão.
- Nenhuma mudança para conta real, aumento automático de risco ou envio de ordem real sem autorização específica.
- Manter limites de risco e trilha de auditoria; não usar taxas de acerto isoladas para promover estratégias.
- Nunca versionar chaves, tokens ou credenciais.

## Próxima implementação
Adicionar endpoint de estado normalizado por agente, integrar cartões do painel, criar testes automatizados e verificar o deploy. Registrar separadamente: código concluído, testes executados e publicação confirmada.
