# Connection URLs

Connection URLs for the test databases. Copy and paste into **Import from URL** to test.

## SQLite

No Docker needed. The database file is at `docker/sqlite/zequel.db`. To recreate it:

```
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
