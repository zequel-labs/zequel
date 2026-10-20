# Plano: backup e restauração independentes e transferência de dados confiável

**Estado:** em implementação. As etapas só serão consideradas concluídas após seus gates; telas novas e testes unitários, isoladamente, não encerram o trabalho.
**Branch:** `refactor/backup-restore-overhaul`, PR #41.
**Base:** [auditoria de código e interface](../reviews/2026-10-20-data-transfer-audit.md).
**Referência:** TablePlus instalado, inspecionado nesta sessão.

Este documento substitui como plano vigente a especificação e o plano de extração de 2026-06-16. Reaproveitar a extração já feita na branch; não reiniciar esse trabalho nem aplicar as antigas exceções de validação.

## 1. Objetivo e escopo

### Atualização do Node solicitada em 2026-10-20

Incluir no mesmo PR a migração do Node de desenvolvimento e CI para Node 26, autorizada explicitamente pelo usuário, em commit próprio. `.nvmrc` fixa 26.10.0; engines e todos os workflows foram alinhados. A validação multiplataforma e o empacotamento permanecem pendentes.

Evidência local em 2026-10-20: instalação limpa com Node 26.10.0; typecheck aprovado; 100 arquivos / 4.560 testes unitários aprovados; SQLite e DuckDB executaram consultas no Electron 33.4.11 e keytar carregou. A instalação exigiu better-sqlite3 12.10.1 e override de yauzl 3.4.0 dentro de extract-zip, corrigindo extração incompleta no Node 26 (https://github.com/electron/electron/issues/51619). Scripts de instalação têm permissões explícitas por versão no package.json.

Build do aplicativo e documentação aprovados. E2E PostgreSQL de backup/restauração em janelas independentes, com ferramentas incluídas, aprovado após instalação limpa (1 teste, 4,1 s). Logs locais: `/tmp/zequel-node26-{install,typecheck,unit,build,docs,e2e}.log`.

- Fixar a versão de desenvolvimento e alinhar engines, documentação e workflows de CI, documentação e release.
- Verificar e atualizar apenas as dependências necessárias à compatibilidade, incluindo better-sqlite3, DuckDB, keytar, ferramentas de build e reconstrução de módulos nativos.
- Distinguir o Node do host do runtime embarcado: atualizar Node no CI não atualiza o Node do Electron 33. Avaliar separadamente a atualização do Electron e suas mudanças incompatíveis; manter tipos e APIs compatíveis com o runtime efetivamente embarcado.
- Gate: instalação limpa, typecheck, testes unitários, integrações, E2E de transferência e empacotamento por plataforma. Revalidar os benchmarks no runtime final.
- Registrar a versão e o suporte escolhidos: em 2026-10-20, Node 26 está em Current, com LTS previsto para 2026-10-28, conforme https://github.com/nodejs/Release. Não tratar uma mudança de número de versão como migração concluída.

O usuário abre Backup ou Restauração na home, escolhe conexão e banco, configura a operação e acompanha sua execução sem abrir uma sessão de navegação. Cada trabalho controla seus recursos e apresenta resultado verificável.

Importar/exportar **linhas** continua contextual à tabela ou resultado de consulta, com origem/destino explícitos: arquivo ou clipboard. Não confundir importação de linhas com restauração de banco.

Incluído: nove motores, novas telas, binários necessários embutidos no aplicativo, destino correto, integridade, formatos oferecidos, SSH/TLS, cancelamento, resultado parcial, migração dos pontos de entrada e testes reais de ida e volta.

Fora desta entrega: agendamento, armazenamento em nuvem, PITR, backup de cluster inteiro, retomada automática após crash e serviço que continue após encerrar o aplicativo.

“Motor implementado” exige backup → restore em destino isolado e comparação de dados/estrutura aplicáveis. Construir um comando válido ou passar em mocks não basta.

## 2. Decisões de produto

| Área | Decisão |
|---|---|
| Entrada | Home e menu global: **Backup Database** e **Restore Database**, disponíveis sem conexão aberta. |
| Tela | Janela Electron própria, reutilizando renderer, tema e componentes do Zequel. Não será aba de uma conexão. |
| Atalho contextual | Abre a mesma janela com conexão/banco preenchidos, sem emprestar a sessão do editor. |
| Estado | Main process é fonte de verdade; renderer consome snapshot e eventos. |
| Backup | “Banco completo” é escopo próprio. “Objetos selecionados” somente onde suportado; todas as tabelas selecionadas não equivalem a banco completo. |
| Restore | Destino explícito e visível; nunca selecionar silenciosamente o primeiro banco retornado. |
| Banco novo | **New database** quando permitido pelo motor e permissões; arquivo novo para bancos embarcados. |
| Ferramentas incluídas | Todo executável necessário aos fluxos suportados acompanha o instalador, com suas dependências. Nenhuma instalação local ou download no primeiro uso é requisito. |
| Avançado | Seleção automática de ferramenta compatível. Versão e flags recolhidas por padrão; caminho personalizado é opcional e nunca requisito. Redis/ClickHouse não pedem executável. |
| Progresso | Fase, tempo, bytes e contagens reais; sem porcentagem inventada. |
| Resultado | Sucesso, avisos, parcial, falha e cancelamento distintos; erro de dados não recebe sucesso verde. |
| Histórico | Operações da execução atual do app; sem persistir credenciais nem prometer retomada após reinício. |
| Repetição | Novo ID e novos recursos. Restore parcial exige revisar destino/conflitos, sem repetição cega. |

### Fechar, cancelar e sair

- Fechar a janela da operação não cancela o trabalho. Reabrir pela home/menu permite acompanhar o mesmo ID.
- Fechar a última janela com trabalho ativo mantém o aplicativo executando também em Windows/Linux; indicar isso e garantir reabertura pelo aplicativo.
- Cancelar passa por `Cancelling` até processos/streams/lotes pararem. Enviar um sinal não equivale a concluir cancelamento.
- Restore cancelado pode ter alterações aplicadas. Mostrar essa condição e contagens conhecidas, sem prometer rollback universal.
- Sair explicitamente com trabalho ativo oferece permanecer ou cancelar e sair. Encerrar recursos antes do shutdown; término forçado deve deixar clara a possibilidade de resultado parcial.
- Cancelamento/quit têm deadlines por fase, definidos e testados na implementação. Se driver/túnel não responder, encerrar a conexão exclusiva; se processo ignorar encerramento, escalar. Ao exceder o prazo, oferecer término forçado explicitamente, sem declarar sucesso ou rollback. Não manter o aplicativo preso indefinidamente.
- Crash/kill não tem retomada automática nesta entrega. Identificar temporários próprios; não apagar conteúdo preexistente na limpeza.

## 3. Fluxos e desenho das telas

Usar a separação observada no TablePlus com identidade visual do Zequel: Reka UI, componentes `ui/`, tokens e padrões de teclado/foco. Não imitar controles nativos macOS em todas as plataformas.

### Referência de interação validada no TablePlus

Inspeção de 2026-10-20 limitada à conexão PostgreSQL de **Local Servers**, sem selecionar conexões dos demais grupos. Backup e restore foram abertos pela home, sem abrir editor. Os seletores de arquivo/destino foram cancelados; nenhuma operação foi executada.

- As janelas apresentam conexões agrupadas e pesquisáveis e uma lista de bancos com busca própria. Selecionar a conexão carrega os bancos, sem selecionar automaticamente o primeiro.
- O restore oferece versões embutidas de PostgreSQL 10.5 a 18.0 e um menu de opções que insere flags como itens no campo de configuração. Na conexão inspecionada, apareceram `--no-owner` e `--single-transaction`; isso não prova defaults universais.
- Depois de selecionar o banco, **Start restore…** abre o seletor nativo de arquivo, com **Start restore** como ação final do diálogo. A execução após confirmar arquivo não foi testada.
- O backup mostra versão, opções, Gzip e nome de arquivo com ação Customize. Na conexão inspecionada apareceu `--format=custom`; selecionar o banco preencheu seu nome no campo de arquivo. **Start backup…** abre o diálogo nativo de destino, cuja ação final é **Start backup**.

**Aplicação ao Zequel:** manter uma configuração compacta, com conexão, banco e arquivo visíveis, buscas independentes e opções adaptadas ao motor. As etapas abaixo descrevem a ordem lógica; não obrigam um wizard com uma página por campo. Permitir escolher conexão ou arquivo primeiro e preservar escolhas válidas ao completar os demais campos.

No Zequel, **Choose backup file…** e **Choose destination…** apenas escolhem arquivos/caminhos. Retornar à configuração com arquivo e destino visíveis, validar compatibilidade e apresentar revisão antes de habilitar **Start restore** ou **Start backup**. Assim o botão de executar realmente inicia uma operação já definida. Cancelar o seletor preserva a configuração e não inicia trabalho.

Opções comuns terão nomes e explicações compreensíveis, com flags técnicas em detalhes avançados. Ações como substituir objetos e criar banco devem usar controles explícitos e participar da revisão; não reproduzir um menu de flags que possa contornar a política de destino.

### Backup

1. **Origem:** conexões pesquisáveis, grupos e ambiente; banco explícito; estados de carregamento, autenticação e erro. Não abre editor.
2. **Escopo/arquivo:** banco completo ou objetos; formato compatível; destino e extensão coerentes.
3. **Revisão:** conexão, banco, escopo, destino local/servidor, formato, compressão e observações de consistência. CTA **Start backup**.
4. **Execução/resultado:** fases, cancelamento, arquivo final real; **Show in Folder** somente para artefato local existente; detalhes técnicos recolhidos.

Layout: cabeçalho com contexto; origem e configuração na área principal; resumo e CTA em rodapé; opções avançadas recolhidas. Janela estreita empilha colunas, preservando rolagem, foco e ação principal.

### Restauração

1. **Arquivo/pasta:** formato detectado por conteúdo quando possível, validade e informações básicas; inspeção não executa SQL.
2. **Destino:** conexão, ambiente e banco ou **New database**; caminho de arquivo para SQLite/DuckDB; caminho explicitamente remoto para SQL Server.
3. **Política/revisão:** criar em vazio, adicionar ou substituir conforme capacidade. Substituição não fica escondida em flags. CTA **Start restore** somente após validação.
4. **Execução/resultado:** mesmos estados de backup; relatório de erros e efeitos parciais; abrir banco restaurado é ação posterior explícita.

Mudar conexão, arquivo, banco ou opção invalida a revisão. Resultados assíncronos antigos não podem sobrescrever uma escolha nova.

### Importação/exportação de linhas

Referência inspecionada no TablePlus em 2026-10-20: tabela `public.ad_accounts` do banco local Amorank, aberta pelo usuário. Primeira rodada limitada aos diálogos e ao preview com CSV sintético de três colunas. Em seguida, com autorização explícita, executada importação em tabela nova e isolada, conforme evidência abaixo; `ad_accounts` não foi alterada.

- Menu da grade distingue **Copy Rows**, **Copy Selected Cells**, respectivos formatos e **Export current page…**. Copiar oferece texto, JSON, HTML, Markdown, CSV com/sem cabeçalho e INSERT SQL.
- Exportação da página mostra contagem, seleção de campos e formatos CSV/JSON/SQL/Excel. CSV oferece delimitador, aspas, quebra de linha, decimal, cabeçalho e conversões de NULL/vazios e quebras de linha.
- Menu da tabela oferece **Export Tables…** (lista de tabelas com seleção) e **Export this Table with Column Selection…**, separados da página atual. O diálogo de seleção de tabelas foi aberto; execução e fidelidade dos arquivos não foram testadas.
- Importação contextual oferece CSV, JSON e SQL dump. CSV abre seletor de arquivo e depois preview das primeiras 100 linhas, destino, encoding, delimitador, aspas, cabeçalho, mapeamento e opção de criar tabela.
- No teste, o modo inicial **Match Columns by Name and Order** não associou as três colunas do CSV à tabela de 15 colunas. Ao selecionar **Match Columns by Name**, `provider`, `name` e `status` foram associados, com contagem explícita de três correspondências. Campos não associados exibiam **Do not import**. O menu de execução oferecia **STOP ON ERROR** e **UPDATE ON DUPLICATE**, posteriormente testados na tabela isolada abaixo.

Aplicar ao Zequel a distinção clara entre células, linhas selecionadas, página/resultado e tabela inteira, com destino e contagem visíveis. Mapeamento por nome deve propor correspondências e permitir revisão/ignorar coluna explicitamente. Não copiar silenciosamente conversões destrutivas de dados: NULL para vazio e quebra de linha para espaço são opções explícitas. Formatos extras observados no TablePlus são referência, não ampliação automática do escopo; implementar e validar os formatos oferecidos pelo Zequel. Importação de SQL dump tem contrato próprio e não deve ser tratada como CSV/JSON de registros.

**Teste real de criação e importação:** arquivo sintético `/tmp/zequel-import-test-20261020.csv`, quatro registros e colunas `id`, `name`, `notes`, `amount`. Ao marcar **Create new table**, o TablePlus desabilitou o seletor de tabela existente, inferiu `int4`, `text`, `text`, `float` e passou a indicar quatro colunas para importar. Ao clicar **Import**, criou `public."zequel-import-test-20261020"` no banco local `amorank`, usando o nome do arquivo sem solicitar outro nome. Exibiu aviso para recarregar os dados. Após recarregar e abrir a tabela, a grade confirmou quatro registros, preservando acentos, vírgula, aspas duplas, quebra de linha dentro da célula e campo textual vazio. Tabela mantida para inspeção do usuário. Não foram testados NULL explícito nem precisão numérica além dos valores exibidos.

**Consequência para o plano:** na criação por importação, mostrar e permitir revisar nome/schema e tipos inferidos antes de executar; decimais exatos não devem ser convertidos silenciosamente em ponto flutuante. Ao concluir, apresentar contagens e ação para abrir/atualizar a tabela criada. Quatro registros não permitem avaliar progresso ou cancelamento de importações longas.

**Rodada funcional adicional autorizada no Amorank:** tabela `public.zequel_transfer_checks_20261020`, criada pelo editor SQL do TablePlus com `id integer PRIMARY KEY`, `name text NOT NULL`, `notes text`, `amount numeric(18,2)`. Dados e arquivos exclusivamente sintéticos em `/tmp/zequel-transfer-checks/`.

| Caso executado | Resultado observado |
|---|---|
| STOP ON ERROR; CSV com IDs 3, 1 duplicado, 4; base com IDs 1 e 2 | Alerta de chave duplicada com SQL. Após recarregar, ID 3 persistiu; ID 4 não entrou. Falha parcial, sem rollback integral. |
| Mesmo CSV com UPDATE ON DUPLICATE | ID 1 atualizado para nome `Atualizado` e valor 11; ID 4 inserido; total de quatro linhas, sem duplicar IDs existentes. |
| CSV com ID 5 válido, `INVALID` e ID 7 válido | Alerta `column "invalid" does not exist`; SQL exibido tratou o valor inválido como expressão sem aspas. ID 5 persistiu; ID 7 não entrou. Pré-validação de tipos e parâmetros são essenciais no Zequel. |
| Colar duas linhas TSV, IDs 8 e 9 | Criou alterações pendentes na grade. Preview mostrou dois INSERTs; somente após Commit as linhas passaram a integrar o total de sete registros. |
| Filtro `id >= 3`, limite de duas linhas, uma linha selecionada; Export current page | CSV salvo com exatamente IDs 3 e 4, verificado lendo o arquivo. Seleção não restringiu a exportação da página. |
| Mesmo filtro e paginação; Export filter result | Preview exibiu SELECT com WHERE/ORDER BY e sem LIMIT. CSV salvo com IDs 3, 4, 5, 8 e 9, verificado lendo o arquivo. |
| CSV de 200 mil registros; Stop durante execução | Progresso mostrou bytes processados e ações Stop/Import in Background. Após Stop, a janela fechou; consulta encontrou 83.647 registros novos persistidos (IDs 1000–84646), além dos sete anteriores. Cancelar não desfez registros gravados. |

Manter testes regressivos de erro após lote já confirmado e cancelamento com dados persistidos; mostrar contagens/resultados parciais, distinguindo parar de desfazer. Colagem de grade deve respeitar o ciclo existente de alterações pendentes/commit, em vez de gravar imediatamente por um caminho paralelo. Exportação deve nomear explicitamente seleção, página e todos os resultados filtrados, sem confundir limite visual com escopo. As observações acima são desta versão/macOS/PostgreSQL e não demonstram comportamento universal dos outros motores.

- Importar: arquivo/clipboard → opções → preview → mapeamento → revisão → execução → resultado.
- Exportar: distinguir seleção, resultado carregado e tabela inteira, deixando claro se filtros/limites se aplicam. Tabela inteira usa streaming.
- CSV/JSON não são backups integrais; export SQL identifica dialeto.
- Fechar diálogo durante trabalho não perde seu resultado. Reutilizar acompanhamento de operações sem obrigar conexão independente para importação contextual.
- Revisar light/dark, tamanho mínimo, teclado, listas grandes, texto longo, vazio, erro, binário ausente e parcialidade no app real.

## 4. Arquitetura

### Responsabilidades propostas

| Módulo | Responsabilidade |
|---|---|
| `backup/capabilities.ts` | Capacidades serializáveis por motor/formato: escopo, ferramenta, arquivo/pasta, compressão, destino, criação de banco e políticas. |
| `backup/OperationManager.ts` | IDs, estados, snapshots/eventos, acompanhamento, cancelamento e conclusão única. |
| `backup/OperationContext.ts` | Resolver configuração e adquirir/liberar conexão, driver, túnel, credenciais e acesso exclusivo a arquivo. |
| Resolução de ferramentas (evoluir `BinaryFinder.ts`) | Resolver conjuntos embutidos por motor, versão, sistema e arquitetura; validar compatibilidade e eventual override explícito, sem depender do PATH. |
| `backup/artifacts.ts` | Temporários exclusivos, escrita/flush, compressão, publicação e cleanup restrito. |
| Clientes existentes por motor | Particularidades de backup/restore; reaproveitar extração, evitando hierarquia genérica desnecessária. |
| `backup/archive.ts` e inspeção | Detectar formato, extrair com segurança, encontrar raiz correta de diretório/archive e preservar compatibilidade. |
| IPC/preload | Contratos validados e tipados, ownership e snapshots sem segredos. |
| `renderer/stores/operations.ts` | Cache e assinatura de snapshots; sem possuir processos/conexões. |
| Shell da janela | Configuração, revisão, execução e lista de operações sem montar o editor. |

Nomes são propostas, não exigência de criar módulos vazios. Resolver a duplicação entre modelos existentes (`Command`, `BackupCommandSpec`) antes de adicionar um terceiro contrato equivalente.

### Binários embutidos: requisito de distribuição

Decisão confirmada pelo usuário: **instalar o Zequel deve bastar para disponibilizar todas as ferramentas locais necessárias aos fluxos suportados**. Não exigir Homebrew, instalação de servidor/cliente de banco, edição de PATH nem localização manual de executáveis. A conexão com o servidor continua necessária e pertence à operação.

Referência: o TablePlus instalado contém ferramentas PostgreSQL e MySQL dentro de `Contents/Resources`, junto de bibliotecas dependentes. A [documentação oficial](https://tableplus.com/docs/gui-tools/backup-and-restore) confirma a distribuição das ferramentas e a seleção de versão por conexão. A implementação do Zequel terá seus próprios artefatos e processo de distribuição, sem copiar arquivos da instalação do TablePlus.

- Empacotar cada conjunto necessário no instalador correspondente ao sistema/arquitetura suportado pelo Zequel. Incluir bibliotecas, módulos auxiliares e permissões de execução; não depender de bibliotecas presentes apenas na máquina de desenvolvimento.
- PostgreSQL inclui `pg_dump`, `pg_restore` e `psql`; MySQL inclui `mysqldump` e `mysql`; MariaDB inclui ferramentas próprias; MongoDB inclui `mongodump` e `mongorestore`. Se SQLite, DuckDB ou SQL Server usarem CLI após as provas da etapa 2, ela e suas dependências também serão embutidas. Caminhos por driver não ganham CLI desnecessária.
- Fixar versões e registrar origem, checksums, licenças/avisos de redistribuição, dependências e combinações suportadas em manifesto versionado. Obter ferramentas de fontes oficiais ou builds reproduzíveis próprios. Verificar a viabilidade de distribuição por plataforma antes de fechar a matriz.
- Resolver executáveis em recursos do aplicativo empacotado, fora do ASAR quando necessário, com caminhos absolutos. Preparar explicitamente o carregamento das bibliotecas; não depender do diretório corrente, PATH ou instalação pessoal.
- Selecionar automaticamente um conjunto compatível com servidor, operação e formato/versão do backup. Validar o conjunto completo, incluindo utilitários auxiliares; não aceitar apenas o primeiro arquivo encontrado. A [documentação do PostgreSQL](https://www.postgresql.org/docs/18/app-pgdump.html) explica que `pg_dump` não atende servidores de major superior à sua.
- Definir na etapa 2 quais versões precisam coexistir e a faixa efetivamente validada. Não prometer versões futuras; incompatibilidade deve ser detectada antes de mutar o destino e explicada com ação adequada, como atualizar o Zequel.
- Atualizar ferramentas pelo processo de release do aplicativo, com verificação de integridade e assinatura/notarização aplicáveis. Downloads em runtime não substituem o pacote obrigatório. Medir tamanho dos instaladores sem retirar ferramentas necessárias para reduzir tamanho.
- Caminho personalizado, se mantido, fica em opções avançadas como override explícito e validado. Configurações antigas de caminhos locais não devem impedir o uso padrão das ferramentas embutidas; preservar a preferência para revisão, sem herdar silenciosamente dependência externa.
- Ausência/corrupção de ferramenta incluída é falha de instalação, com orientação para reparar/atualizar o Zequel; não pedir que o usuário instale o banco ou procure um binário.

### Identidade, conexão e recursos

- Separar `operationId`, `savedConnectionId`, sessão de navegação e ID de túnel. Pedido usa conexão escolhida + banco explícito, não `activeSessionId`.
- Credenciais resolvidas no main pelos serviços existentes; nunca retornar senha, PEM privado ou URI secreta ao renderer.
- Conexão não salva pode originar rascunho efêmero no main a partir do contexto existente. Copiar configuração sem tomar posse da sessão nem salvar automaticamente.
- Listagem de bancos/objetos usa contexto temporário próprio, liberado ao terminar; não altera seleção/abas do editor.
- Restore em banco inexistente usa conexão administrativa/de manutenção adequada. Criação é explícita e validada, sem escolher outro banco como fallback.
- Fazer preflight de formato, ferramenta e permissões antes de criar destino. Registrar se banco/arquivo foi criado por esta operação e tratar corrida de criação como conflito. Se o restore falhar, preservar e identificar o destino parcial por padrão; não apagar automaticamente um banco que pode ter passado a ser usado. Excluir depois exige ação explícita e validação de ownership.
- Execução fixa configuração; editar/excluir conexão salva depois não redireciona trabalho em andamento.
- SSH/TLS: separar endpoint de transporte de host lógico necessário à validação de certificado. Não resolver problemas desabilitando validação.
- Corrigir destino em caminho de driver exige conexão própria desde o primeiro patch: nunca executar `USE`/`SELECT` ou alterar schema/database no driver emprestado do editor.
- DuckDB e substituição de SQLite coordenam acesso ao arquivo. Bloquear com mensagem acionável enquanto houver uso incompatível; não fechar sessões nem descartar alterações silenciosamente.
- Reservar destinos/arquivos que não admitem operações concorrentes. Trabalhos independentes não recebem um teto arbitrário.

### API e estados

API proposta: capacidades/binários; rascunho; listagem de bancos/objetos; inspeção de arquivo; validação/revisão sanitizada; iniciar; consultar/listar snapshots; assinar eventos; cancelar; resultado final.

- Preview não cria PEM, inicia dump ou modifica banco.
- Revalidar no main ao iniciar. Mudança de arquivo ou destino após revisão não pode passar despercebida.
- Flags avançadas não podem sobrescrever host, banco, arquivo, escopo ou política destrutiva revisados. Reservar/validar essas opções, suas variantes curtas, repetidas e `--flag=value`; rejeitar conflito antes da execução. Não basta sanitizar o comando exibido.
- Assinar antes de iniciar e reconciliar com snapshot após obter ID, cobrindo operações rápidas.
- Eventos têm ID e sequência crescente; ignorar eventos atrasados. Cancelamento e cleanup idempotentes.
- Definir acesso das janelas confiáveis no main; conhecer um ID arbitrário não concede acesso.
- Atualizar main types, `src/preload/index.ts` e `src/renderer/types/electron.d.ts` juntos.

Fluxo normal: `Validating → Preparing → Running → Finalizing → Succeeded`.
Alternativas: `Cancelling → Cancelled`, `Failed` e `Partial`.

Avisos não escondem falha de itens obrigatórios. Finalização inclui flush, streams fechados, compressão, validação básica do artefato e publicação. Subprocesso concluído não encerra a operação. Emitir um único estado terminal.

Dumps não são acumulados em stdout/arrays/snapshots. Usar streams e logs com buffer limitado, arquivo local por operação, retenção definida e relatório sanitizado.

### Progresso e performance — critérios obrigatórios

Reforçado pelo usuário em 20/10: importação/exportação podem processar milhares ou milhões de registros. **Toda importação, exportação, backup e restauração deve apresentar progresso visual desde a preparação até a conclusão**, mantendo a interface responsiva. Não entregar apenas spinner ou logs como acompanhamento.

**Comportamento da interface**

- Barra determinada quando existir total confiável: percentual mais unidade explícita, como `34.500 / 100.000 linhas` ou `128 / 512 MB lidos`. Atualizar também quando houver progresso sem mensagens de log.
- Barra indeterminada quando não houver total: fase atual, quantidade processada conhecida e tempo decorrido. Não fabricar percentual a partir de tempo, número de mensagens ou estimativa de linhas. Mostrar taxa/tempo restante apenas quando houver dados estáveis suficientes, identificados como estimativa.
- Separar leitura/validação, transferência, aplicação no banco, compressão e finalização. `100% lido` não significa `100% restaurado`; a operação só conclui depois de flush, commit aplicável, publicação e liberação de recursos.
- Distinguir linhas lidas, validadas, enviadas e efetivamente confirmadas. Resultado informa importadas/exportadas, rejeitadas, ignoradas e eventuais mudanças parciais. Rollback deve atualizar a contagem confirmada, não deixar uma barra de sucesso.
- Cancelar permanece acessível. Exibir `Cancelando…` até os recursos serem encerrados; não prometer desfazer mudanças já persistidas.
- Fechar/reabrir a janela recupera fase, métricas e resultado do main. Barra acessível (`progressbar`, unidade e texto), sem anúncios de leitor de tela a cada linha.
- Ferramentas nativas oferecem métricas diferentes: consumir somente contadores reais disponibilizados por cada ferramenta ou pelo transporte. No `.bak` remoto, não exibir bytes do filesystem local como progresso do servidor.

**Processamento e consumo de recursos**

- O renderer do Electron usa Chromium; Node executa a infraestrutura. Não processar arquivos grandes no renderer nem bloquear o event loop do main com parsing/serialização/compressão síncronos.
- CSV/JSON e formatos próprios usam leitura incremental, escrita em stream e backpressure. Preview tem amostra limitada, nunca cópia integral do arquivo. Não usar `readFile` + parse do documento inteiro em caminhos de grandes volumes.
- Importar em lotes limitados por linhas **e bytes**, com transação/política de erro explícita. Exportar por cursor/páginas adequadas ao motor, sem acumular resultados. Ajustar tamanho do lote com medições; não executar uma chamada IPC por linha.
- Preferir subprocessos para ferramentas nativas e worker threads para trabalho JavaScript intensivo em CPU quando o perfil indicar necessidade. I/O assíncrono por si só não elimina bloqueios de CPU.
- Enviar pelo IPC metadados e métricas compactas. Coalescer atualizações periódicas (referência inicial: até cinco por segundo por operação), emitir mudanças de fase/resultado imediatamente e reconciliar snapshots por sequência. Não reenviar logs completos de todas as operações em cada atualização.
- UI mantém histórico paginado/limitado e listas virtualizadas quando necessário; logs completos ficam em arquivo, carregados sob demanda. Limitar buffers/histórico não limita arbitrariamente o volume de dados nem o número de trabalhos independentes.
- Liberar listeners, timers, cursores, streams, workers, conexões e túneis em sucesso, erro e cancelamento. Testar repetição de operações para detectar crescimento residual.

**Gate de performance com evidências**

- Fixtures de 10 mil, 100 mil e 1 milhão de linhas, incluindo campos largos/JSON/BLOB, CSV multiline e arquivos maiores que a amostra de preview. Arquivos pequenos não substituem a prova de escala.
- Registrar máquina/OS/versões, tamanho e composição da fixture, duração, linhas/s, MB/s, pico de RSS/heap por processo, atraso do event loop, quantidade/volume de IPC e latência de cancelamento.
- Comparar consumo em 100 mil e 1 milhão de linhas: o conjunto de valores em memória não deve crescer proporcionalmente ao arquivo. Justificar estruturas auxiliares inevitáveis e medir seu custo separadamente.
- Durante a transferência, testar digitação, navegação, arrastar/redimensionar janela e cancelamento. Investigar long tasks acima de 50 ms no renderer e no main; estabelecer orçamento a partir da medição e anexar o resultado, em vez de declarar “rápido” sem evidência.
- Simular banco e disco lentos para provar backpressure, progresso contínuo e ausência de crescimento ilimitado de memória. Testar erro e cancelamento após lotes confirmados.
- Repetir a prova essencial em macOS, Windows e Linux. Não prometer throughput universal: rede, disco, servidor, formato e tamanho das linhas fazem parte do resultado.

### Artefatos e cancelamento

- Destino temporário exclusivo, preferencialmente no mesmo filesystem do final.
- Sobrescrita explícita na UI e conflito revalidado ao publicar. Arquivo anterior intacto se validação, spawn, dump ou compressão falhar.
- Estratégia de substituição testada nos três sistemas; não assumir semântica universal de `rename`.
- Retornar caminho final real; impedir colisão entre original, temporário e comprimido.
- Nunca remover recursivamente um caminho do usuário como resposta genérica a erro.
- Token de cancelamento abrange preparação, driver, leitura, escrita e compressão. Encerrar subprocesso, escalar se necessário e aguardar antes de liberar recursos.
- Backup cancelado remove só temporários próprios; restore cancelado comunica efeitos parciais.
- Extração não permite escape por path traversal/symlink e controla recursos. Arquivo inválido falha antes de executar restore.

## 5. Plano por motor

| Motor | Caminho e critérios específicos |
|---|---|
| PostgreSQL | `pg_dump`; plain por `psql`, custom/directory por `pg_restore`. Banco explícito, full sem `--table`, `ON_ERROR_STOP`, versões, banco novo, dependências/tipos/functions/sequences/extensions, formatos e compressão. Não prometer roles/tablespaces globais. |
| MySQL | `mysqldump`/`mysql`, conexão própria. Charset, tipos exatos, rotinas/triggers/eventos, flags por versão, consistência conforme engine, erro, plain/gzip, SSH/TLS. |
| MariaDB | Ferramentas MariaDB; fallback MySQL somente validado. Fixtures próprias de flags/TLS e fidelidade de dados/objetos. |
| SQLite | Dump/API apropriada, destino isolado, BLOB, FKs, índices/triggers, coordenação de arquivo aberto e falha sem perder destino anterior. |
| DuckDB | CLI com acesso exclusivo coordenado ou API se prova isolada justificar. Resolver lock; não ignorar seleção oferecida; tipos/schema/sequences, arquivo novo e liberação. Escolha final na etapa 2. |
| MongoDB | Ferramentas oficiais. Distinguir diretório/archive/ZIP/compressão, raiz e namespaces corretos, múltiplas coleções, BSON/índices/opções; estado terminal depois de todas as coleções. |
| Redis | Driver próprio e formato versionado incremental. SCAN completo sem teto; payload binário fiel via DUMP/RESTORE quando viável; TTL, streams/grupos/pendências, nomes especiais, conflitos e compatibilidade. Não prometer snapshot consistente sob escrita concorrente sem mecanismo real. |
| ClickHouse | Driver/HTTP próprio, DDL e dados em streaming. Destino explícito; evitar splitter SQL genérico; prova de Native/JSONEachRow antes de escolher formato novo, com tipos/dependências e erros. |
| SQL Server | `.bak` com caminho **no servidor**, não `stat`/ZIP local. Propagar erro (`-b` se CLI), replace explícito, acesso exclusivo, destino novo e nomes físicos quando necessário. Transferência automática de arquivos fora até existir transporte real. |

### Compatibilidade

- Ler formatos recuperáveis produzidos pela versão atual. Formatos próprios novos identificam motor/versão sem credenciais.
- Redis JSON legado é reconhecido explicitamente, com aviso de limites; não é possível recuperar entradas que nunca foram gravadas.
- MongoDB JSON legado não se confunde com BSON/archive; usar Extended JSON oficial para dados recuperáveis e reportar representações já perdidas.
- ClickHouse SQL antigo precisa de leitor do dialeto e tratamento de erros, mesmo com novo escritor.
- Fixtures reais para PostgreSQL directory ZIP, MongoDB ZIP e gzip. Extensão sozinha não decide leitor.
- Trocar escritor apenas após round-trip e compatibilidade testados. Não adicionar manifesto a todo dump nativo sem necessidade.

### Destino embutido no arquivo

O seletor de banco não garante o destino real de scripts com `USE`, `CREATE DATABASE`, `\connect`, nomes qualificados ou opções como `pg_restore --create`. Definir política por motor/formato antes de apresentar a revisão:

- Remapear com suporte oficial quando o formato permitir.
- Quando não permitir, identificar o destino efetivo e rejeitar conflito com a seleção antes de mutar; caso exista modo explícito de preservar destino original, apresentar isso claramente para revisão.
- Não fazer substituição textual genérica de nomes em SQL.
- Para scripts arbitrários cujo destino não possa ser determinado, não prometer restauração isolada no banco escolhido. Bloquear o modo seguro ou exigir fluxo explicitamente identificado para execução de script, sem confundi-lo com restore garantido.
- Adicionar fixtures com mudança de banco, nomes qualificados e criação de destino, incluindo dump de A restaurado em B.

## 6. Etapas, arquivos e gates

Checklist atualizado com a implementação e validação local em 20/10. Itens multiplataforma permanecem pendentes até execução do CI; inspeção de arquivos não substitui execução. Evidências: `../reviews/2026-10-20-transfer-validation.md`.

### Etapa 0 — base e regressões

**Arquivos:** testes backup/IPC/import/export, harness Electron/E2E e fixtures.

- [x] Converter probes confirmados em regressões de destino preservado, banco A/B, parcialidade, cancelamento, CSV multiline e JSON SQL.
- [x] Isolar bancos, diretórios e `userData` de teste. Não usar perfil pessoal nem containers de outros projetos.
- [x] Inventariar entradas, consumidores IPC, abas serializadas e transferência entre janelas.
- [x] Conferir branch/instruções; numa integração com main, preservar o novo `AGENTS.md` e não reintroduzir `CLAUDE.md`.

**Gate:** falhas reproduzíveis e ambiente seguro. Não começar por redesenhar telas em cima de contratos frágeis.

### Etapa 1 — integridade e resultado correto

**Arquivos:** `services/backup.ts`, clientes, `archive.ts`, módulos mínimos de artefatos/resultados.

- [x] Corrigir limpeza/publicação, incluindo diretório existente e erro antes de spawn.
- [x] Corrigir estado terminal, erros parciais, psql/sqlcmd e compressão.
- [x] Antecipar aquisição mínima de contexto/conexão própria para os patches de destino, reutilizável na etapa 3; não esperar o gerenciador completo nem alterar a sessão do editor.
- [x] Corrigir banco resolvido e destino ignorado no caminho de driver.
- [x] Separar preview de temporários sensíveis.
- [x] Corrigir ZIPs gerados pelo próprio app e caminho final.

**Gate:** nenhuma falha conhecida apaga backup anterior, troca banco silenciosamente ou reporta sucesso falso.

### Etapa 2 — capacidades e provas técnicas

**Arquivos:** `capabilities.ts`, clientes/serializers e fixtures de integração.

- [x] Matriz implementável de motor/formato/escopo/versão/destino.
- [ ] Política de destinos embutidos e flags reservadas por motor/formato, com preflight e rejeição de conflitos.
- [x] Provas isoladas de DuckDB/arquivo aberto, Redis/payload/TTL/streams e ClickHouse/formato/destino.
- [x] Registrar escolhas concretas após provas; não deixar alternativas para resolver ao conectar a UI.
- [x] Corrigir truncamentos, tipos e leitores legados recuperáveis.
- [ ] Definir matriz de versões de ferramentas embutidas, dependências e compatibilidade por servidor/formato, incluindo viabilidade de redistribuição por sistema/arquitetura.

**Gate:** suporte real por combinação. Não expor combinação não validada; isso não encerra o objetivo de suportar os nove motores.

### Etapa 2A — empacotamento das ferramentas

**Arquivos:** `BinaryFinder.ts`, manifesto de ferramentas, scripts de obtenção/build, recursos do app, configuração electron-builder em `package.json` e workflows de CI/release.

- [x] Produzir conjuntos versionados de fontes verificadas, com checksums, dependências e avisos de licença.
- [ ] Incluir todos os executáveis necessários em cada instalador suportado; resolver recursos em desenvolvimento e no aplicativo instalado.
- [ ] Implementar seleção automática compatível, validação de conjunto completo e erros acionáveis de instalação/incompatibilidade.
- [x] Migrar caminhos personalizados antigos para preferência avançada explícita, mantendo ferramentas incluídas como padrão.
- [ ] Validar permissões, bibliotecas, arquitetura e assinatura/notarização no artefato final; registrar tamanho por plataforma.
- [ ] Executar backup e restore reais a partir do aplicativo empacotado em ambientes sem clientes de banco instalados, sem depender de PATH nem downloads de ferramentas.

**Gate:** instalação limpa basta para executar cada fluxo suportado. A etapa 4 depende deste contrato; um seletor manual de caminho não satisfaz a entrega.

### Etapa 3 — execução independente

**Arquivos:** OperationManager/Context, IPC, preload/types, integração com conexões/túneis.

- [x] Rascunho, inspeção, validação, start, snapshots/eventos/lista/cancel.
- [x] Conexão/túnel próprios e inspeção para destino ainda inexistente.
- [ ] Cancelamento de todas as fases e snapshots sem corrida.
- [x] Contrato compartilhado de fase, unidades, métricas reais, sequência e progresso determinado/indeterminado; snapshots compactos.
- [x] Ownership, múltiplas janelas e exclusão mútua de destinos incompatíveis.

**Gate:** iniciar e concluir sem `activeSessionId`; desconectar/trocar banco no editor não afeta o trabalho.

### Etapa 4 — novas telas

**Arquivos:** `main/index.ts`, `windowManager.ts`, `menu.ts`, `App.vue`, HomeView, componentes/store de operações.

- [x] Bootstrap distingue editor/operação, sem listeners e adoção de sessão do editor na janela nova.
- [x] Home/menu/atalho contextual abrem mesmo fluxo. Renderizar estados com dados controlados antes de executar em banco real.
- [x] Configuração/revisão por capacidades, banco novo, permissões e erros.
- [x] Seletores de arquivo/destino separados da execução; cancelamento preserva rascunho, troca de arquivo revalida compatibilidade e revisão mostra conexão/banco/arquivo juntos.
- [x] Fluxo comum sem campo obrigatório de binário; ferramenta compatível automática, versão em detalhes avançados e erros de instalação tratados como tal.
- [ ] Acompanhamento/lista, fechamento/reabertura e quit nos três sistemas.
- [x] Barras de progresso acessíveis em backup/restore, incluindo preparação/finalização, cancelamento e resultado parcial.
- [x] Tirar vida da operação de `StepExecute.vue`.
- [ ] Revisão visual no aplicativo: light/dark, teclado, mínimo de janela, conteúdo longo, vazio/erro/parcial; comparar navegação com TablePlus.

**Gate:** fluxo completo partindo da home; operação sobrevive ao fechamento da janela; UI consistente com o Zequel.

### Etapa 5 — import/export de linhas

**Arquivos:** TableView, ImportDialog, ExportDialog, IPC import/export e serviço import.

- [x] Parser compartilhado para arquivo/clipboard, CSV multiline e delimitador tab real.
- [x] Contrato de BIGINT/DECIMAL, JSON, binário, datas e vazio/null.
- [x] Mapeamento sem duplicatas/omissões silenciosas; validar antes de limpar tabela.
- [x] Menu e revisão distinguem células/linhas selecionadas, página/resultado e tabela inteira; preview de importação identifica campos associados/ignorados e destino, com mapeamento por nome testado para subconjuntos e ordem diferente.
- [x] Transação onde suportada; nos demais casos pré-validação, política de erro e resultado parcial explícitos.
- [x] Streaming/lotes/backpressure/cancelamento; sem carregar tudo no main/renderer.
- [x] SQL por dialeto e serialização compartilhada entre exportações.
- [x] Contagens reais, progresso e relatório; opções visuais efetivamente alteram resultado.
- [x] Barras de progresso em importar/exportar, com linhas/bytes, fases e recuperação ao reabrir; nenhuma barra fictícia.
- [x] Preview limitado, parser incremental, lotes/cursor com backpressure e métricas de memória/IPC/event loop.

**Gate:** export → import preserva dados nos contratos oferecidos.

### Etapa 6 — migração e limpeza

**Arquivos:** tabs/types, renderização de conteúdo, HeaderBar, preload/types e handlers legados.

- [x] Redirecionar entradas para janela nova.
- [x] Migrar abas Backup/Restore serializadas para rascunho; nunca executar automaticamente.
- [x] Remover código morto somente após verificar consumidores e cobertura substituta.
- [x] Preservar leitores legados separados do backend antigo.
- [x] Documentar formatos, ferramentas incluídas/faixas de versões, caminhos locais/remotos e limites de consistência; remover instruções de instalação externa como pré-requisito.

**Gate:** um fluxo efetivo para cada finalidade, sem testes que validam somente caminho abandonado.

### Etapa 7 — validação final

- [x] Typecheck/unitários completos; round-trips dos nove motores e combinações oferecidas.
- [x] E2E das novas telas e import/export com diálogos nativos controlados pelo harness.
- [ ] Cross-platform de subprocessos, paths, binários, fechamento e permissões.
- [ ] Validar instaladores finais em ambientes limpos de cada sistema/arquitetura suportado, usando exclusivamente ferramentas incluídas.
- [ ] Revisar navegação, troca/desconexão de banco, transferência entre janelas, safe mode e privacy mode.
- [ ] Atualizar descrição/título do PR para o escopo final e registrar evidências efetivas.
- [ ] Executar o gate de performance acima com fixtures de escala, lentidão, cancelamento e repetição; anexar medições por plataforma.

**Gate:** Definition of done abaixo satisfeita. Sem merge/deploy implícitos.

## 7. Matriz de validação

Cada round-trip: criar origem isolada → backup real → destino novo/vazio → restore real → comparar valores, contagens e objetos. Incluir banco diferente do salvo e nomes com espaços/aspas/Unicode.

| Motor | Fixtures mínimas |
|---|---|
| PostgreSQL | Enum/domínio, schema não public, função/trigger, sequence, bytea, JSONB, boolean; plain/custom/directory e compressão oferecida. |
| MySQL/MariaDB | BIGINT/DECIMAL exatos, utf8mb4, binário, rotinas/triggers/eventos e flags específicas. |
| SQLite/DuckDB | Arquivo em uso/novo, tipos, views/índices/triggers ou equivalentes suportados, permissões e falha no destino. |
| MongoDB | ObjectId/Date/Long/Decimal128/Binary, índices, coleções vazias/múltiplas, mudança de banco e formatos. |
| Redis | Mais de 50 mil chaves e 10 mil entradas de stream; IDs/grupos/pendências, TTL, binário, `__proto__`, conflitos e erro ACL. |
| ClickHouse | Aspas/barras/ponto e vírgula, Nullable/Decimal/UInt64/Array/DateTime, DDL/dependências e destino distinto. |
| SQL Server | `.bak` no servidor/container, arquivo ausente, permissão negada, destino novo, replace explícito e banco em uso. |

### Falhas e lifecycle

- Binário ausente/incompatível, erro de spawn, erro SQL com exit 0, falha no meio de coleção/lote, arquivo malformado.
- Falta de espaço/permissão, falha de stream/compressão, colisão, arquivo anterior e diretório anterior.
- Cancelar em cada fase; exatamente um estado terminal; sem subprocesso/túnel órfão.
- Fechar/reabrir janela, trocar/desconectar editor, duas janelas acompanhando, sair e perder SSH.
- Sem permissão para criar banco; credenciais fora de logs/snapshots; temporários/PEMs limpos.
- Banco novo criado seguido de falha parcial, corrida de criação e inspeção do recurso remanescente, sem remoção automática.
- Processo que ignora SIGTERM, driver sem resposta e fechamento simultâneo de janelas; deadlines e término forçado sem status incorreto.
- Safe mode continua bloqueando mutações no contexto correspondente. Restore tem contexto e política próprios, sem herdar ou contornar proteção por acidente.

### CI

- Migrar para Node 26 (versão fixada em `.nvmrc`), typecheck/unitários nos três sistemas existentes.
- Adicionar round-trips em serviços isolados Linux; shardar por motor se necessário.
- Testes de distribuição usam exclusivamente ferramentas embutidas, sem PATH de clientes, Homebrew, Herd ou dependências de desenvolvimento. Sem download de ferramentas no primeiro uso; acesso ao servidor de teste permanece permitido.
- Testar seleção entre versões, servidor incompatível, ferramenta/biblioteca ausente ou corrompida, arquitetura incorreta, paths com espaços/Unicode e override avançado inválido.
- Validar backup/restore no artefato instalado de cada sistema/arquitetura publicado, não apenas no modo de desenvolvimento. Falha de empacotamento bloqueia release.
- Dependência ausente em job obrigatório faz falhar; skip local aparece como skip real, não early return aprovado.
- Fixar versões de servidores/ferramentas e declarar faixa validada; não prometer todas as versões.
- Evidências de falha: logs sanitizados, comparação de dados e screenshots E2E, sem dados pessoais.
- Tratar ABI nativa Node/Electron no harness quando necessário, sem pular testes silenciosamente.
- Fixtures reais SSH/TLS: sucesso por túnel com validação do host lógico; rejeição de CA/hostname incorretos; desconectar editor sem afetar operação; cancelar/fechar sem túnel órfão. Cobrir as famílias de transporte efetivamente usadas, não apenas mocks de flags.

### Definition of done

- [x] Backup/restore iniciam da home sem sessão aberta.
- [ ] Instaladores incluem todos os binários/dependências necessários; backup/restore funcionam em ambiente limpo sem instalação externa, download inicial ou configuração manual de caminho.
- [ ] Seleção automática e compatibilidade de ferramentas testadas por plataforma/arquitetura e faixa de versões declarada.
- [ ] Destino explícito e correto em todos os caminhos.
- [x] Backup anterior preservado em falhas; erro nunca disfarçado de sucesso.
- [ ] Round-trip de cada formato oferecido e leitores legados testados.
- [ ] Cancelamento real, parcialidade honesta e cleanup garantido.
- [x] Navegação/fechamento de janela não interrompem trabalho.
- [x] CSV multiline e tipos especiais preservados conforme contrato.
- [ ] Light/dark, acessibilidade e plataformas revisados.
- [ ] Nenhum requisito concluído apenas com mocks/inspeção estática.

## 8. Controle de execução

Executar por checkpoints, com mudanças pequenas e verificáveis. Aproveitar os clientes extraídos; não trocar backend e UI inteiros de uma vez.

O usuário autorizou implementar e executar até o final, mantendo tudo no PR #41, incluindo commit/push da entrega. Não há autorização implícita para merge ou publicação de release. Registrar incompatibilidades com evidência e solução; a validação pendente continua aberta.

Não usar `--no-verify`: a justificativa do plano antigo está obsoleta. Nesta auditoria, typecheck e 4.680 testes unitários passaram.
