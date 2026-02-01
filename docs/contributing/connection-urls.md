# Connection URLs

Connection URLs for the development databases started by Docker Compose. Copy and paste these into Zequel's **Import from URL** dialog to connect quickly.

## SQLite

No Docker needed. The database file is at `docker/sqlite/zequel.db`. To recreate it:

```bash
sqlite3 docker/sqlite/zequel.db < docker/sqlite/init.sql
```

## PostgreSQL

```
postgresql://zequel:zequel@localhost:54320/zequel
```

## MySQL

```
mysql://zequel:zequel@localhost:33060/zequel
```

## MariaDB

```
mariadb://zequel:zequel@localhost:33070/zequel
```

## MongoDB

```
mongodb://zequel:zequel@localhost:27018/zequel?authSource=admin
```

## Redis

```
redis://:zequel@localhost:63790
```

## ClickHouse

```
clickhouse://zequel:zequel@localhost:18123/zequel
```
