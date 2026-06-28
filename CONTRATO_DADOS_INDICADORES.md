# Contrato de Dados — Indicadores (DF / MTBF / MTTR)

Este é o **padrão único** de entrada de indicadores no SGF. Tudo (farol, gráficos,
indicadores, gatilho de plano de ação) lê da tabela `sgff.indicadores_kpi`.
Se os dados chegarem neste formato, o sistema funciona sem retrabalho.

---

## 1. Tabela de destino: `sgff.indicadores_kpi`

| coluna            | tipo    | obrigatório | descrição |
|-------------------|---------|-------------|-----------|
| `frota`           | text    | sim         | `geral` (frota inteira) **ou** o nome da **categoria** — **tem que ser idêntico** ao `categoria` da tabela `equipamentos` (ex: `Escavadeiras de Produção`, `Carregadeiras`). Obs: o campo `equipamentos.frota` (AUX/PRO) é outra coisa e **não** é usado aqui. |
| `tipo_periodo`    | text    | sim         | `diario` \| `semanal` \| `mensal` |
| `data_referencia` | date    | sim         | `AAAA-MM-DD` (ver regra abaixo) |
| `df_percent`      | numeric | sim         | Disponibilidade Física em % (ex: `84.2`) |
| `mtbf_horas`      | numeric | não         | Tempo médio entre falhas (h) |
| `mttr_horas`      | numeric | não         | Tempo médio de reparo (h) |
| `num_falhas`      | int     | não         | nº de falhas no período |
| `observacoes`     | text    | não         | texto livre |

### Regra do `data_referencia`
- **diario** → o próprio dia. Ex: `2026-06-27`.
- **semanal** → o **último dia** da semana fechada. Ex: `2026-06-21`.
- **mensal** → o **primeiro dia** do mês. Ex: `2026-06-01`.

### Regra do `frota`
- `geral` = consolidado de toda a frota (usado nos cards do topo do farol).
- Por frota = mesmo nome da **categoria** de `equipamentos`. Categorias existentes:
  ```sql
  select distinct categoria from sgff.equipamentos order by 1;
  ```

---

## 2. Como cada indicador alimenta o farol

| Card / gráfico do farol | de onde vem |
|---|---|
| DF dia anterior | `diario`, `geral`, data = ontem |
| Ritmo hoje (até 7h) | `diario`, `geral`, data = hoje (lançamento parcial do dia) |
| Acum. semana | `semanal`, `geral`, mais recente |
| Acum. mês | `mensal`, `geral`, mês corrente |
| Indicadores por frota | `mensal`, cada frota, mês corrente |
| DF% histórico mensal | `mensal`, ao longo dos meses |
| DF mês corrente até hoje | `diario`, `geral`, dias do mês atual |
| DF/MTBF/MTTR por frota nos meses | `mensal`, cada frota, vários meses |
| Frotas abaixo da meta (gatilho do plano de ação) | `semanal`/`mensal`, cada frota, `df_percent < 85` |

---

## 3. Padrão de ENVIO (o que você me manda)

Você me cola um bloco de texto neste formato e eu converto em SQL para inserir.

### Lançamento diário
```
#DIARIO 2026-06-27
geral; 87.5; 210; 5.1
EXC;   82.1; 195; 6.2
CAM;   79.8; 182; 7.8
```
Colunas: `frota; df; mtbf; mttr` (mtbf e mttr opcionais — pode deixar vazio: `geral; 87.5; ;`)

### Lançamento semanal / mensal
```
#SEMANAL 2026-06-21
geral; 86.1; 218; 5.2
EXC;   84.7; 209; 5.4
```
```
#MENSAL 2026-06-01
geral; 84.2; 215; 5.5
EXC;   82.1; 195; 6.2
```

### Histórico do ano (em lote)
```
#HISTORICO MENSAL
frota; data;       df;   mtbf; mttr
geral; 2026-01-01; 83.4; 200;  5.6
geral; 2026-02-01; 88.7; 225;  4.7
EXC;   2026-01-01; 80.1; 180;  6.8
...
```

> Pode mandar quantas linhas quiser. Eu gero o `INSERT` e te devolvo pronto pra colar
> no SQL Editor (ou aplico direto se preferir).

---

## 4. Meta
- Meta de DF: **85%** (constante `DF_META` no código). Abaixo disso dispara o gatilho de plano de ação.
