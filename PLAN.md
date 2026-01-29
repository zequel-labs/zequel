# DB Studio - Roadmap

## O que já temos implementado ✅

### Conexões
- SQLite, MySQL, PostgreSQL, MariaDB, Redis, MongoDB, ClickHouse
- SSH Tunnel support
- SSL/TLS support com gerenciamento de certificados
- Armazenamento seguro de senhas (Keychain)
- Múltiplas conexões simultâneas
- Test connection
- Cores personalizadas por conexão

### Query Editor
- Monaco Editor com syntax highlighting
- Auto-complete (tabelas, colunas, keywords, procedures, functions)
- Múltiplas abas de query
- Execução de queries com parâmetros
- Query EXPLAIN visualizado (PostgreSQL JSON, MySQL JSON, SQLite)
- Histórico de queries (com tempo de execução, row count, erros)
- Queries salvas (CRUD)
- Cancelamento de query
- Execução de texto selecionado
- Keyboard shortcuts (⌘Enter para executar)
- Formatação/beautify de SQL
- Snippets/templates de SQL (30+ built-in, custom, por dialeto)

### Schema Management
- Navegação de schema (databases, tabelas, colunas, índices, FKs)
- Criar/renomear/deletar tabelas
- Adicionar/modificar/renomear/deletar colunas
- Criar/deletar índices
- Criar/deletar foreign keys
- View DDL (CREATE statement)
- Primary key identification

### Data Management
- Visualização de dados com paginação
- Edição in-cell
- Insert/delete de rows
- Multi-row selection e deletion
- Filtros com múltiplos operadores (=, ≠, >, <, LIKE, IN, IS NULL, etc.)
- Redimensionar/reordenar colunas (drag & drop)
- Drag & drop de tabs
- Esconder/mostrar colunas
- Bulk update de rows, duplicar rows, editar múltiplas células
- Undo/Redo para alterações
- Cell value viewer (JSON/XML pretty-print, hex dump, image preview)

### Views & Routines
- CREATE/ALTER/DROP VIEW
- View DDL
- Stored Procedures (list, view definition)
- Functions (list, view definition)
- Triggers (list, view definition, create, drop)

### Export/Import
- Export para CSV (com escaping, delimiters, headers)
- Export para JSON
- Export para SQL (INSERT statements)
- Export para Excel (.xlsx)
- Export para clipboard ou arquivo
- Import de SQL files
- Import de CSV
- Import de JSON
- Backup completo (dump all tables)
- Restore de backup

### Gerenciamento de Usuários
- Listagem de usuários
- Visualização de permissões/GRANT

### Monitoring
- Process Monitor (SHOW PROCESSLIST / pg_stat_activity)
- Kill query/connection (graceful ou force)
- Variáveis do servidor
- Status do servidor
- Auto-refresh toggle

### UI/UX
- Dark/Light theme (com detecção de sistema)
- Keyboard shortcuts globais
- Split view / múltiplos painéis
- Sidebar redimensionável
- Diagrama ER interativo
- Tabs com status indicators
- Tabelas/views/queries recentes
- Toast notifications
- Busca global / Command Palette (⌘K)
- Favoritos/bookmarks (tabelas, views, queries)

### PostgreSQL Específico
- Schemas (múltiplos, não apenas public)
- Sequences (CRUD, view details, alter, copy DDL)
- Materialized Views (list, refresh, CONCURRENTLY, DDL)
- Extensions (list, install, uninstall, search)
- Enums (list, view values)

### MySQL Específico
- Charset/Collation editor (table/database level)
- Partitions (list, create RANGE/LIST/HASH/KEY, drop)
- Events/Scheduler (list, create, alter, drop, status)

### Editor Settings
- Font size
- Tab size
- Word wrap toggle
- Minimap toggle
- Line numbers toggle
- Persistent settings

---

## O que falta implementar 📋

### Alta Prioridade

#### Novos Bancos de Dados
- [x] MariaDB (similar ao MySQL)
- [x] Redis
- [x] MongoDB
- [x] ClickHouse

#### Export/Import de Dados
- [x] Export para Excel (.xlsx)
- [x] Import de CSV
- [x] Import de JSON

#### Visualização de Dados Avançada
- [x] Esconder/mostrar colunas
- [ ] Filter builder visual (UI drag & drop para filtros)
- [ ] Busca global nos resultados
- [x] Viewer para BLOB/binário
- [x] Pretty print para JSON/XML
- [x] Preview de imagens

### Média Prioridade

#### Query Editor Avançado
- [x] Formatação/beautify de SQL
- [x] Snippets/templates de SQL
- [ ] Multi-cursor editing

#### Segurança
- [x] Gerenciamento de certificados SSL
- [ ] Criptografia de credenciais melhorada

#### Edição Avançada de Dados
- [x] Bulk update de rows
- [x] Copiar/duplicar rows
- [x] Editar múltiplas células
- [x] Undo/Redo para alterações
- [ ] Rollback de transação

### Baixa Prioridade

#### UI/UX Extras
- [x] Cores personalizadas por conexão
- [x] Favoritos/bookmarks
- [x] Busca global (tabelas, colunas, dados)
- [ ] Keyboard shortcuts customizáveis

#### Performance
- [ ] Query profiling avançado
- [ ] Slow query log viewer

#### Diagrama ER
- [ ] Comparação de schemas
- [ ] Export de diagrama como imagem (PNG/SVG)

---

## Bancos de Dados Suportados

### SQLite ✅
- Driver: `better-sqlite3`

### MySQL ✅
- Driver: `mysql2`
- Charset/Collation, Partitions, Events

### PostgreSQL ✅
- Driver: `pg`
- Schemas, Sequences, Materialized Views, Extensions, Enums

### MariaDB ✅
- Driver: `mysql2` (compatível)
- Detecção automática de versão MariaDB vs MySQL

### Redis ✅
- Driver: `ioredis`
- Key browser (STRING, LIST, SET, HASH, ZSET, STREAM)
- TTL visualization, key patterns search, ACL

### MongoDB ✅
- Driver: `mongodb`
- Collection browser, document viewer/editor (JSON)
- Shell-style query parser, schema inference

### ClickHouse ✅
- Driver: `@clickhouse/client`
- MergeTree engine support, partition management
- System tables, data-skipping indexes

---

## Histórico de Implementação

### Janeiro 2026 (Batch 2)
- ✅ MariaDB support (driver via mysql2, detecção de versão)
- ✅ Redis support (ioredis, SCAN, 6 data types, TTL, ACL)
- ✅ MongoDB support (mongodb client, shell-style queries, schema inference)
- ✅ ClickHouse support (@clickhouse/client, MergeTree, partitions, system tables)
- ✅ Export para Excel (.xlsx)
- ✅ Import de CSV
- ✅ Import de JSON
- ✅ Visualização avançada de dados (CellValueViewer: JSON/XML pretty-print, hex dump, image preview)
- ✅ Esconder/mostrar colunas no grid
- ✅ Formatação/beautify de SQL (sql-formatter)
- ✅ Snippets/templates de SQL (30+ built-in, custom, por dialeto)
- ✅ Gerenciamento de certificados SSL
- ✅ Bulk data operations (undo/redo, duplicar rows, bulk column edit)
- ✅ Cores personalizadas por conexão
- ✅ Favoritos/bookmarks (tabelas, views, queries)
- ✅ Busca global (Command Palette com ⌘K)
- ✅ Testes unitários (143 testes, 13 arquivos)

### Janeiro 2026 (Batch 1)
- ✅ Split view (múltiplos painéis)
- ✅ Monitoring (PROCESSLIST, kill query, server status)
- ✅ Triggers (list, view definition, create, drop)
- ✅ PostgreSQL: Sequences, Materialized Views, Extensions, Schemas, Enums
- ✅ MySQL: Charset/Collation, Partitions, Events
- ✅ Auto-complete de tabelas e colunas no editor SQL
- ✅ Zoom/pan no diagrama ER
- ✅ Export de dados (CSV, JSON, SQL)
- ✅ Redimensionar/reordenar colunas no grid
- ✅ Drag & drop de tabs
- ✅ Tabelas/views/queries recentes (SQLite local)

### Anteriormente
- ✅ Conexões multi-database
- ✅ Query editor com Monaco
- ✅ Syntax highlighting
- ✅ Múltiplas abas
- ✅ Histórico e queries salvas
- ✅ Schema editing
- ✅ Views CRUD
- ✅ Stored procedures/functions
- ✅ User management
- ✅ Backup/restore
- ✅ SSH Tunneling
- ✅ Dark/Light theme
- ✅ Diagrama ER
