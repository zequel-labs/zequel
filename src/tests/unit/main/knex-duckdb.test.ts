import { describe, it, expect } from 'vitest';
import knexLib from 'knex';
import DuckDBClient from '@main/db/knex-duckdb/client';

const createKnex = () => knexLib({ client: DuckDBClient as any, useNullAsDefault: true });

describe('DuckDBClient', () => {
  it('should have duckdb as driverName and dialect', () => {
    const client = new DuckDBClient({ client: 'duckdb' });
    expect(client.driverName).toBe('duckdb');
    expect(client.dialect).toBe('duckdb');
  });

  it('should return empty object from _driver', () => {
    const client = new DuckDBClient({ client: 'duckdb' });
    expect(client._driver()).toEqual({});
  });

  it('should wrap identifiers with double quotes', () => {
    const client = new DuckDBClient({ client: 'duckdb' });
    expect(client.wrapIdentifierImpl('users')).toBe('"users"');
  });

  it('should not wrap asterisk', () => {
    const client = new DuckDBClient({ client: 'duckdb' });
    expect(client.wrapIdentifierImpl('*')).toBe('*');
  });

  it('should escape double quotes in identifiers', () => {
    const client = new DuckDBClient({ client: 'duckdb' });
    expect(client.wrapIdentifierImpl('col"name')).toBe('"col""name"');
  });
});

describe('DuckDB Knex integration', () => {
  it('should generate SELECT queries with double-quoted identifiers', () => {
    const knex = createKnex();
    const result = knex('users').select('*').toSQL();

    expect(result.sql).toBe('select * from "users"');
  });

  it('should generate single-row INSERT', () => {
    const knex = createKnex();
    const result = knex('users').insert({ name: 'Alice', age: 30 }).toSQL();

    expect(result.sql).toContain('insert into "users"');
    expect(result.sql).toContain('values');
  });

  it('should generate multi-row INSERT with UNION ALL SELECT', () => {
    const knex = createKnex();
    const result = knex('users').insert([
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ]).toSQL();

    expect(result.sql).toContain('insert into "users"');
    expect(result.sql).toContain('union all select');
  });

  it('should return empty string for empty array insert', () => {
    const knex = createKnex();
    const result = knex('users').insert([]).toSQL();

    expect(result.sql).toBe('');
  });

  it('should generate WHERE queries', () => {
    const knex = createKnex();
    const result = knex('users').where('id', 1).toSQL();

    expect(result.sql).toBe('select * from "users" where "id" = ?');
    expect(result.bindings).toEqual([1]);
  });

  it('should generate schema DDL for createSchema', () => {
    const knex = createKnex();
    const result = knex.schema.createSchema('analytics').toSQL();

    expect(result).toHaveLength(1);
    expect(result[0].sql).toBe('create schema "analytics"');
  });

  it('should generate schema DDL for createSchemaIfNotExists', () => {
    const knex = createKnex();
    const result = knex.schema.createSchemaIfNotExists('analytics').toSQL();

    expect(result).toHaveLength(1);
    expect(result[0].sql).toBe('create schema if not exists "analytics"');
  });

  it('should generate schema DDL for dropSchema', () => {
    const knex = createKnex();
    const result = knex.schema.dropSchema('analytics').toSQL();

    expect(result).toHaveLength(1);
    expect(result[0].sql).toBe('drop schema "analytics"');
  });

  it('should generate schema DDL for dropSchema with cascade', () => {
    const knex = createKnex();
    const result = knex.schema.dropSchema('analytics', true).toSQL();

    expect(result).toHaveLength(1);
    expect(result[0].sql).toBe('drop schema "analytics" cascade');
  });

  it('should generate schema DDL for dropSchemaIfExists', () => {
    const knex = createKnex();
    const result = knex.schema.dropSchemaIfExists('analytics').toSQL();

    expect(result).toHaveLength(1);
    expect(result[0].sql).toBe('drop schema if exists "analytics"');
  });

  it('should generate schema DDL for dropSchemaIfExists with cascade', () => {
    const knex = createKnex();
    const result = knex.schema.dropSchemaIfExists('analytics', true).toSQL();

    expect(result).toHaveLength(1);
    expect(result[0].sql).toBe('drop schema if exists "analytics" cascade');
  });

  it('should generate CREATE TABLE with double-quoted identifiers', () => {
    const knex = createKnex();
    const result = knex.schema.createTable('users', (table) => {
      table.integer('id').primary();
      table.string('name');
    }).toSQL();

    expect(result).toHaveLength(1);
    expect(result[0].sql).toContain('create table "users"');
    expect(result[0].sql).toContain('"id"');
    expect(result[0].sql).toContain('"name"');
  });

  it('should generate DELETE queries', () => {
    const knex = createKnex();
    const result = knex('users').where('id', 1).delete().toSQL();

    expect(result.sql).toBe('delete from "users" where "id" = ?');
    expect(result.bindings).toEqual([1]);
  });
});

// ─── DuckDBQueryCompiler — uncovered branches ─────────────────────────────

describe('DuckDBQueryCompiler insert branches', () => {
  it('should return empty insert value for empty object insert', () => {
    const knex = createKnex();
    const result = knex('users').insert({}).toSQL();

    expect(result.sql).toContain('insert into "users"');
    expect(result.sql).toContain('default values');
  });

  it('should return empty insert value for array with single empty object', () => {
    const knex = createKnex();
    const result = knex('users').insert([{}]).toSQL();

    expect(result.sql).toContain('insert into "users"');
    expect(result.sql).toContain('default values');
  });

  it('should generate single-row insert with onConflict ignore', () => {
    const knex = createKnex();
    const result = knex('users')
      .insert({ name: 'Alice', age: 30 })
      .onConflict('name')
      .ignore()
      .toSQL();

    expect(result.sql).toContain('insert into "users"');
    expect(result.sql).toContain('values');
    expect(result.sql).toContain('on conflict');
    expect(result.sql).toContain('nothing');
  });

  it('should generate single-row insert with onConflict merge', () => {
    const knex = createKnex();
    const result = knex('users')
      .insert({ name: 'Alice', age: 30 })
      .onConflict('name')
      .merge()
      .toSQL();

    expect(result.sql).toContain('insert into "users"');
    expect(result.sql).toContain('values');
    expect(result.sql).toContain('on conflict');
    expect(result.sql).toContain('do update set');
  });

  it('should generate single-row insert with returning clause', () => {
    const knex = createKnex();
    const result = knex('users')
      .insert({ name: 'Alice', age: 30 })
      .returning('id')
      .toSQL();

    expect(result.sql).toContain('insert into "users"');
    expect(result.sql).toContain('values');
    expect(result.sql).toContain('returning');
    expect(result.sql).toContain('"id"');
  });

  it('should generate multi-row insert with onConflict ignore', () => {
    const knex = createKnex();
    const result = knex('users')
      .insert([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ])
      .onConflict('name')
      .ignore()
      .toSQL();

    expect(result.sql).toContain('insert into "users"');
    expect(result.sql).toContain('union all select');
    expect(result.sql).toContain('where true');
    expect(result.sql).toContain('on conflict');
    expect(result.sql).toContain('nothing');
  });

  it('should generate multi-row insert with onConflict merge', () => {
    const knex = createKnex();
    const result = knex('users')
      .insert([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ])
      .onConflict('name')
      .merge()
      .toSQL();

    expect(result.sql).toContain('insert into "users"');
    expect(result.sql).toContain('union all select');
    expect(result.sql).toContain('where true');
    expect(result.sql).toContain('on conflict');
    expect(result.sql).toContain('do update set');
  });

  it('should generate multi-row insert with returning clause', () => {
    const knex = createKnex();
    const result = knex('users')
      .insert([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ])
      .returning('id')
      .toSQL();

    expect(result.sql).toContain('insert into "users"');
    expect(result.sql).toContain('union all select');
    expect(result.sql).toContain('returning');
    expect(result.sql).toContain('"id"');
  });
});

// ─── DuckDBColumnCompiler — increments() ──────────────────────────────────

describe('DuckDBColumnCompiler', () => {
  it('should generate increments column with sequence DDL', () => {
    const knex = createKnex();
    const result = knex.schema.createTable('orders', (table) => {
      table.increments('id');
      table.string('product');
    }).toSQL();

    // The main CREATE TABLE statement should have integer not null primary key
    const createSql = result[0].sql;
    expect(createSql).toContain('create table "orders"');
    expect(createSql).toContain('"id" integer not null primary key');

    // Additional statements for the sequence
    expect(result.length).toBeGreaterThanOrEqual(2);
    const allSql = result.map((r) => r.sql).join(' ');
    expect(allSql).toContain('create sequence');
    expect(allSql).toContain('orders_seq_id');
    expect(allSql).toContain('alter table');
    expect(allSql).toContain('set default nextval');
  });
});

// ─── DuckDBTableCompiler — primaryKeys with constraint name ───────────────

describe('DuckDBTableCompiler', () => {
  it('should generate primary key with constraint name in CREATE TABLE', () => {
    const knex = createKnex();
    const result = knex.schema.createTable('items', (table) => {
      table.integer('a');
      table.integer('b');
      table.primary(['a', 'b'], { constraintName: 'pk_items_ab' });
    }).toSQL();

    const sql = result[0].sql;
    expect(sql).toContain('create table "items"');
    expect(sql).toContain('constraint');
    expect(sql).toContain('pk_items_ab');
    expect(sql).toContain('primary key');
  });

  it('should generate primary key without constraint name', () => {
    const knex = createKnex();
    const result = knex.schema.createTable('items', (table) => {
      table.integer('a');
      table.integer('b');
      table.primary(['a', 'b']);
    }).toSQL();

    const sql = result[0].sql;
    expect(sql).toContain('create table "items"');
    expect(sql).toContain('primary key');
    // Should not contain 'constraint' when no name is provided
    expect(sql).not.toContain('constraint');
  });

  it('should use wrapped table name via tableName()', () => {
    const knex = createKnex();
    const result = knex.schema.createTable('my_table', (table) => {
      table.integer('id');
    }).toSQL();

    expect(result[0].sql).toContain('"my_table"');
  });
});
