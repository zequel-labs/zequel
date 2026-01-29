# DB Studio - Roadmap

## O que já temos implementado ✅

### Core Features
- Conexões (SQLite, MySQL, PostgreSQL)
- Navegação de schema (databases, tabelas, colunas, índices, FKs)
- Visualização de dados com paginação
- Execução de queries
- Histórico de queries
- Queries salvas
- Edição in-cell
- Schema editing (colunas, índices, FKs, tabelas)
- Insert/delete de rows

### Query Editor
- Syntax highlighting (Monaco Editor)
- Auto-complete (tabelas, colunas, keywords, procedures, functions)
- Múltiplas abas de query
- Query EXPLAIN visualizado

### Views & Routines
- CREATE/ALTER/DROP VIEW
- Stored Procedures (view definition)
- Functions (view definition)
- Triggers (view definition, list, sidebar)

### Gerenciamento de Usuários
- Listagem de usuários
- Visualização de permissões/GRANT

### Performance & Monitoring
- Process Monitor (SHOW PROCESSLIST / pg_stat_activity)
- Kill query/connection
- Variáveis do servidor
- Status do servidor

### UI/UX
- Toggle Dark/Light theme
- Keyboard shortcuts (globais)
- Split view / múltiplos painéis
- Diagrama ER interativo (zoom, pan, drag)
- Redimensionar/reordenar colunas no grid
- Drag & drop de tabs
- Tabelas/views recentes

### Backup
- Export de backup (dump SQL)
- Import de backup (SQL file)

### Export/Import de Dados
- Export para CSV
- Export para JSON
- Export para SQL

### PostgreSQL Específico
- Schemas (não apenas public)
- Sequences (CRUD, view details, nextval)
- Materialized Views (list, refresh, DDL)
- Extensions (install, uninstall, available list)
- Enums (list, copy values/DDL)

### MySQL Específico
- Charset/Collation editor (table/database level)
- Partitions (list, create, drop)
- Events/Scheduler (list, view definition, create, alter, drop)

---

## O que falta implementar 📋

### Alta Prioridade

#### Export/Import de Dados
- [ ] Export para Excel
- [ ] Import de CSV
- [ ] Import de JSON

#### Visualização de Dados Avançada
- [ ] Esconder/mostrar colunas
- [ ] Filter builder visual (UI para filtros)
- [ ] Busca global nos resultados
- [ ] Viewer para BLOB/binário
- [ ] Pretty print para JSON/XML
- [ ] Preview de imagens

### Média Prioridade

#### Query Editor Avançado
- [ ] Formatação/beautify de SQL
- [ ] Snippets/templates

#### Segurança
- [ ] Gerenciamento de certificados SSL
- [ ] Criptografia de credenciais melhorada

#### Edição Avançada de Dados
- [ ] Bulk update de rows
- [ ] Copiar/duplicar rows
- [ ] Editar múltiplas células
- [ ] Undo/Redo para alterações
- [ ] Rollback de transação

### Baixa Prioridade

#### UI/UX Extras
- [ ] Cores personalizadas por conexão
- [ ] Favoritos/bookmarks
- [ ] Busca global (tabelas, colunas, dados)

#### Performance
- [ ] Query profiling avançado
- [ ] Slow query log

#### Diagrama ER
- [ ] Comparação de schemas
- [ ] Export de diagrama como imagem

---

## Histórico de Implementação

### Janeiro 2026
- ✅ Split view (múltiplos painéis)
- ✅ Monitoring (PROCESSLIST, kill query, server status)
- ✅ Triggers (list, view definition, TriggerView)
- ✅ PostgreSQL: Sequences, Materialized Views, Extensions, Schemas, Enums
- ✅ MySQL: Charset/Collation, Partitions, Events
- ✅ Auto-complete de tabelas e colunas no editor SQL
- ✅ Zoom/pan no diagrama ER
- ✅ Export de dados (CSV, JSON, SQL)
- ✅ Redimensionar/reordenar colunas no grid
- ✅ Drag & drop de tabs
- ✅ Tabelas/views recentes (sidebar)

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
