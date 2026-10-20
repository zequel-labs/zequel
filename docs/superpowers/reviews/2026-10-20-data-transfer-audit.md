# Zequel — auditoria de backup, restauração, importação e exportação

Branch: `refactor/backup-restore-overhaul`, PR #41.

## Conclusão

A extração de clientes por banco é um avanço, mas a operação continua dependente da sessão de navegação e há defeitos de integridade, destino, cancelamento e indicação de sucesso. O PR ainda não entrega um fluxo confiável de backup → restauração.

O requisito confirmado com o usuário é ter telas próprias de backup e restauração, acessíveis antes de abrir um banco, seguindo a organização observada no TablePlus instalado. Não basta mover o botão: o trabalho precisa controlar suas próprias conexões, arquivos, processos e túneis.

## Verificações realizadas e limites

- Revisão do código atual, diff da branch, clientes dos nove bancos, IPC, serializadores, telas, configuração de testes e planos existentes.
- Revisão adicional por GPT-6 Astra com esforço xhigh.
- `npm ci` com Node 20, mesma versão principal usada pelo CI.
- `npm run typecheck`: passou.
- Suíte unitária: **94 arquivos, 4.680 testes passaram**.
- Probes seguros utilizando funções reais e dependências simuladas reproduziram exclusão de destino anterior ao spawn, sucesso falso no restore por driver, cancelamento ineficaz e perdas de serialização.
- Probe das funções reais da interface reproduziu CSV multiline quebrado; probe do exportador SQL produziu `'[object Object]'` para JSON.
- TablePlus: inspecionadas visualmente as janelas independentes de backup/restauração. Nenhum backup ou restore foi executado nele.
- Não foram executados round-trips reais dos nove motores: os containers de teste do Zequel não estavam ativos. O container disponível pertencia a outro projeto e não foi utilizado.
- Nenhum arquivo-fonte do repositório foi alterado nesta auditoria.

## Defeitos prioritários

P1: corrigir antes de confiar no fluxo. P2: defeito funcional relevante. As localizações se referem à branch auditada.

| Severity | Location (file:line) | Finding |
|---|---|---|
| P1 | `src/main/services/backup.ts:269` | Qualquer erro remove `outputPath`, mesmo antes de criar um novo arquivo. Um backup anterior pode ser apagado; diretórios são removidos recursivamente. Reproduzido com erro anterior ao spawn e filesystem simulado. Novo no PR. |
| P1 | `src/main/ipc/backup.ts:60` | A configuração salva prevalece sobre o banco atual da sessão, salvo quando o banco salvo está vazio. Após trocar de banco, pode fazer backup do banco anterior. Preexistente. |
| P1 | `src/main/services/backup.ts:400` | Restore por driver não aplica `targetDatabase`; ClickHouse usa o driver atual apesar do destino selecionado. Novo caminho no PR. |
| P1 | `src/main/services/backup/native/redis-serializer.ts:18` | “Full Database” chama `getAllKeys()` com limite padrão de 50 mil chaves (`db/redis.ts:816`). Streams limitadas a 10 mil entradas (`redis-serializer.ts:63`). Truncamento silencioso. Implementação antiga promovida ao novo backup. |
| P1 | `src/main/services/backup/native/redis-serializer.ts:193` | Restore de streams usa IDs novos (`*`), perde campo legítimo `_id` e não preserva grupos/pendências. Chave `__proto__` também desaparece na serialização baseada em `{}`. Perdas reproduzidas. |
| P1 | `src/main/services/backup.ts:422` | Redis/ClickHouse recebem `Completed` mesmo com zero itens restaurados e erros. Reproduzido com erro de ACL. |
| P1 | `src/main/services/backup/restore-clients/postgresql.ts:104` | Restore plain SQL não configura `ON_ERROR_STOP`; erro SQL pode não gerar exit code de falha. O serviço confia no exit code. Preexistente. |
| P1 | `src/main/services/backup/backup-clients/sqlserver.ts:25` | Backup e restore com `sqlcmd -Q` sem `-b` não propagam adequadamente erro SQL para o status da operação. Preexistente. |
| P1 | `src/main/utils/sql.ts:16` | Splitter ignora escapes com barra invertida. SQL válido com `\'` e `;` dentro do texto é dividido incorretamente no restore ClickHouse. Reproduzido. |
| P1 | `src/main/services/backup/archive.ts:29` | ZIP de PostgreSQL directory contém `toc.dat` e arquivos de dados, mas o extrator só reconhece outras extensões ou arquivo único. O ZIP gerado não restaura por esse caminho. |
| P1 | `src/main/services/backup.ts:289` | ZIP MongoDB extraído produz diretório, mas `isDirectory` permanece falso e o cliente passa o diretório para `--archive`. O formato produzido pelo backup não corresponde ao restore. |
| P1 | `src/main/services/backup/backup-clients/duckdb.ts:19` | CLI abre o arquivo DuckDB que o driver da aplicação já mantém aberto para escrita. Conflito de processos; precisa coordenar acesso exclusivo. Confirmado por código/documentação, sem reprodução local do CLI. |
| P1 | `src/main/services/backup/backup-clients/postgresql.ts:58` | Selecionar todas as entidades gera vários `--table`, não um dump completo do banco. Dependências e objetos fora das tabelas não são automaticamente incluídos. Falta opção explícita de banco completo. |
| P2 | `src/main/services/backup/restore-clients/sqlserver.ts:22` | `.bak` é lido/escrito pelo servidor, mas validação, seleção e compressão tratam o caminho como local. Não há transferência entre os filesystems. |
| P2 | `src/main/services/backup.ts:171` | Cancelamento só mata subprocessos. Redis/ClickHouse não estão em `runningProcesses`; o pedido retorna falso e o trabalho continua. Reproduzido. |
| P2 | `src/main/services/backup.ts:475` | Conclusão é marcada após cada subprocesso, antes das demais coleções MongoDB e antes da compressão. A UI pode liberar navegação enquanto o trabalho continua. |
| P2 | `src/main/ipc/backup.ts:187` | Preview executa builders que criam PEMs temporários, mas não limpa os arquivos. Preview deveria não criar recursos sensíveis ou sempre descartá-los. |
| P2 | `src/renderer/views/BackupView.vue:74` | A interface exige `binaryPath` mesmo em Redis/ClickHouse, cujo backend novo usa driver. Mesma exigência em RestoreView e StepExecute. |
| P2 | `src/renderer/components/restore/StepRestoreConfigure.vue:66` | Destino inicial é o primeiro banco retornado, não uma escolha explícita nem necessariamente o banco esperado. Não há resumo de destino antes de executar. |
| P2 | `src/renderer/views/TableView.vue:741` | Importação CSV ativa divide por quebras de linha antes de interpretar aspas. Uma célula multiline vira dois registros; erro reproduzido. |
| P2 | `src/main/ipc/export.ts:111` | Exportação SQL é genérica: JSON vira `[object Object]`, booleanos viram `1/0`, identificadores usam aspas duplas em todos os motores. Não preserva tipos/dialetos. JSON inválido reproduzido. |

A documentação oficial confirma a necessidade de distinguir seleção de tabelas de dump completo e a semântica de falha das ferramentas:

- [pg_dump — seleção por tabela e dependências](https://www.postgresql.org/docs/current/app-pgdump.html)
- [psql — ON_ERROR_STOP e exit status](https://www.postgresql.org/docs/current/app-psql.html)
- [sqlcmd — opção -b](https://learn.microsoft.com/en-us/sql/tools/sqlcmd/sqlcmd-utility?view=sql-server-ver17#-b)
- [DuckDB — concorrência entre processos](https://duckdb.org/docs/current/connect/concurrency)
- [ClickHouse — sintaxe e escapes](https://clickhouse.com/docs/reference/syntax)

## Situação por banco

| Banco | Principais pendências antes de validação completa |
|---|---|
| PostgreSQL | Banco correto; dump completo vs tabelas; erro SQL; plain/custom/directory; directory + ZIP; seleção de pasta na UI. |
| MySQL | Banco correto; preservação do arquivo anterior; round-trip real de tipos, rotinas, triggers, eventos e TLS. |
| MariaDB | Mesmos pontos MySQL, mais compatibilidade do fallback de binário e flags TLS. |
| SQLite | Preservação do destino; estados de execução/compressão; restauração em arquivo separado e schema completo. Probe básico de `.dump` funcionou. |
| DuckDB | Coordenação do arquivo com o driver aberto; o cliente ignora seleção de tabelas; processo independente do editor é especialmente importante. |
| ClickHouse | Banco de destino; SQL com escapes; status de erros; cancelamento; volume em memória e fidelidade de DDL/dados. |
| MongoDB | Diretório vs archive vs ZIP; progresso de múltiplas coleções; restore em banco novo; tipos BSON e índices. |
| Redis | Sem limites silenciosos; preservação de streams, IDs, campos, TTL e dados binários; erros parciais e cancelamento. |
| SQL Server | Caminho remoto vs local; propagação de erros; substituição explícita; restauração com conexões existentes. |

## Importação/exportação: caminhos reais e código antigo

O fluxo ativo de importação da tabela é `TableView.handleImport`: lê o clipboard e insere linha por linha. A legenda “Import CSV/JSON” não comunica essa origem. Não usa o `ImportDialog.vue` com arquivo, preview e mapeamento. Esse componente não está montado no renderer atual.

Consequências no caminho ativo:

- Arquivo exportado não tem um fluxo correspondente de seleção de arquivo na tabela.
- CSV multiline não faz round-trip.
- Linhas com nenhuma coluna reconhecida são ignoradas, mas o toast usa o número de linhas lidas, não inseridas.
- Uma falha no meio deixa inserções anteriores aplicadas, sem resultado parcial estruturado.
- Texto vazio e texto literal `NULL` viram `null`.
- Parsing e laço de importação vivem dentro de uma view extensa, em vez de um serviço de dados testado.

Há também handlers legados `backup:export`/`backup:import` ainda expostos no preload, mas sem chamadas no renderer atual. Eles limitam SQL a 10 mil linhas por tabela e MongoDB a 50 mil documentos por coleção. O serializador legado MongoDB não preserva integralmente BSON. Isso é dívida de API/código morto; não deve ser apresentado como comportamento da nova tela de backup.

O handler `import:execute` do fluxo de arquivo também tem conversões arriscadas (`BIGINT` para Number), exclusão anterior à importação sem atomicidade e SQL genérico para limpar tabela. Reativar o diálogo existente sem corrigir esses pontos apenas exporia outros defeitos.

A exportação completa da tabela já tem cursor e backpressure, o que é uma base útil. Entretanto, o serializador SQL se repete entre caminhos, e o fluxo de streaming ignora a opção JSON `prettyPrint`. Falha antes de entrar no `try/finally` do cursor também pode deixar o schema temporariamente escolhido no driver.

## TablePlus observado e proposta para o Zequel

No TablePlus instalado, a tela inicial oferece `Backup Database` e `Restore Database`. Cada ação abre uma janela própria, antes de entrar no editor de banco:

- Seleção de conexão e banco com busca.
- Configuração do utilitário e opções da operação.
- Backup com nome de arquivo e compressão.
- Restore com ação `New database`.

Essa observação confirma a separação de navegação. Não prova como o TablePlus implementa internamente conexões, subprocessos ou histórico; essas partes abaixo são propostas para o Zequel.

### Estrutura de produto

1. Ações de Backup e Restauração na home e no menu global.
2. Tela própria com conexão salva, ambiente e banco de origem/destino claramente identificados.
3. Backup: “Banco completo” como escopo próprio; seleção de objetos como modo adicional.
4. Restore: arquivo/pasta com detecção de formato, destino explícito e criação de banco quando suportada.
5. Opções comuns primeiro; binário, versão, flags e logs em seção avançada. Redis/ClickHouse não pedem executável.
6. Resumo antes de executar: origem, destino, formato, escopo e efeito de substituição.
7. Execução com estados reais, quantidade/bytes quando disponíveis, cancelamento e resultado parcial distinto de sucesso.
8. Importar/exportar linhas continua contextual à tabela, com escolha clara entre arquivo e clipboard, preview e mapeamento.

### Infraestrutura necessária

Criar um contexto de operação que resolve e fixa conexão salva, banco escolhido e credenciais. Ele deve adquirir e manter seu próprio driver/túnel ou recurso exclusivo de arquivo até o fim do trabalho.

O estado não deve viver exclusivamente em `StepExecute.vue`. Fechar, reabrir ou trocar abas não pode perder o progresso nem encerrar acidentalmente a conexão de uma operação.

Separar responsabilidades:

- Descrição de capacidades por banco/formato: seleção de entidades, arquivo vs pasta, compressão, destino local vs servidor, binário necessário.
- Validação e planejamento sem efeitos colaterais.
- Aquisição de recursos da operação.
- Execução com cancelamento e tratamento de falhas.
- Gravação em destino temporário exclusivo e publicação do arquivo final somente após sucesso.
- Resultado estruturado, com contagens e avisos; término só depois de todas as etapas.
- Liberação garantida de processos, streams, túneis, drivers, temporários e certificados.

## Ordem sugerida

1. Corrigir exclusão de arquivos anteriores, banco errado e falso sucesso.
2. Definir e implementar o contexto independente de operação.
3. Corrigir formatos, serialização, cancelamento e compressão por motor.
4. Construir telas próprias com base no fluxo observado no TablePlus e nos componentes visuais do Zequel.
5. Unificar import/export efetivos e retirar ou corrigir caminhos legados.
6. Exigir testes de round-trip que comparem schema e dados reais, incluindo falhas, limites e combinações de formato.

## Lacunas de testes

O CI atual roda typecheck e unitários; não exige round-trips dos nove motores. Há testes de integração novos, mas alguns retornam cedo quando dependências não existem, e o teste PostgreSQL usa um caminho absoluto de binário do Herd.

Os testes novos de MongoDB usam diretório sem compressão; os de PostgreSQL directory usam `compress:false`; Redis usa poucos registros e não cobre streams/limites. Isso explica por que a suíte unitária fica verde apesar dos defeitos reproduzidos.

Critérios de aceite: banco diferente do salvo, restore em banco novo, tipos especiais, arquivos grandes, arquivo de destino preexistente, falha SQL, falha de escrita, cancelamento durante cada etapa, ZIP/formatos nativos e operação funcionando sem aba de banco aberta.
