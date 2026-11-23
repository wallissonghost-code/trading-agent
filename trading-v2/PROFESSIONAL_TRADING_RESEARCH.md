# Trading Agent V2 — Práticas profissionais aplicadas ao laboratório

**Status:** pesquisa e simulação; não representa aconselhamento financeiro, aprovação de estratégia ou execução de ordens reais. Nenhum trader individual foi usado como garantia de sucesso.

## Fontes estudadas (referências educacionais e acadêmicas)
- CME Group — Proper Position Size: https://www.cmegroup.com/education/courses/trade-and-risk-management/proper-position-size
- CME Group — Controlling Risk: https://www.cmegroup.com/education/courses/trade-and-risk-management/controlling-risk
- CME Group — Risk Management and Your Trade Plan: https://www.cmegroup.com/education/courses/building-a-trade-plan/risk-management-and-your-trade-plan
- CFA Institute — Backtesting & Simulation (2026): https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/backtesting-and-simulation
- CFA Institute — Trade Strategy and Execution (2026): https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/trade-strategy-execution
- Bailey, Borwein, López de Prado & Zhu — The Probability of Backtest Overfitting: https://scholarworks.wmich.edu/math_pubs/42/
- FINRA — Frequent Intraday Trading: Understanding the Basics: https://syndication.finra.org/content/frequent-intraday-trading-understanding-basics

## Regras implementadas (laboratório de pesquisa somente)
1. **Posicionamento e stop predeterminados.** Até aproximadamente 1% de patrimônio como risco estimado por operação; exposição máxima por posição de 50% do patrimônio. Estes limites não garantem perda máxima porque gaps/slippage podem ultrapassar stops.
2. **Planos imutáveis durante a comparação.** Três candidatos predefinidos: EMA 9/21 + RSI 50–70, EMA 12/26 + RSI 50–70, EMA 9/21 + RSI 55–65. Dados de teste não alteram parâmetros nem robôs ativos.
3. **Separação cronológica 70/30.** Indicadores usam SOMENTE candles conhecidos até a decisão; entrada simulada na abertura do candle seguinte. Teste de 30% final é reservado, sem parametrização com base nele.
4. **Custos explícitos.** Aproximação de taxa spot 0,10% por lado + slippage 0,05% por lado; os valores são hipóteses de estudo, NÃO taxas confirmadas da conta do usuário.
5. **Tratamento conservador de ambiguidades.** Se stop e alvo são tocados no mesmo candle, stop prevalece. Gap abaixo do stop implica fill estimado no preço de abertura piorado por slippage.
6. **Métricas separadas.** Retorno líquido modelado, negócios encerrados, taxa de acerto (somente trades), fator de lucro e drawdown. Acerto direcional do próximo candle é um indicador diferente de lucratividade.
7. **Amostra insuficiente não aprova estratégias.** Uma janela de 500 candles de 5 minutos cobre apenas cerca de 42 horas. Não é suficiente para validar regimes diferentes, períodos de notícias ou constância da estratégia.
8. **Sem aprendizado ativo.** Nenhum resultado modifica o robô online, o gerenciamento de risco, a carteira virtual ou as decisões de entrada.

## Próximos passos com maior rigor
- Capturar histórico maior, em lotes paginados, com verificação de continuidade e armazenamento em Supabase; separar por diferentes meses e regimes.
- Implementar walk-forward com múltiplas janelas e período congelado fora da amostra, além de métricas de sensibilidade a custo e mudança de parâmetros.
- Atribuir resultado das operações virtuais às decisões e versões exatas das estratégias.
- Coletar notícias com publisher, URL canônica, horário de publicação e horário de coleta; evitar vazamento temporal.
- Manter a revisão/aprovação humana antes de qualquer mudança de estratégia ou exposição. Nenhuma ordem real é permitida.
