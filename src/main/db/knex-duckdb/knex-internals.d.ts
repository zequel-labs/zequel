/* eslint-disable @typescript-eslint/no-explicit-any */

// Knex internal modules don't ship type declarations.
// These minimal stubs let us extend them in TypeScript.

declare module 'knex/lib/client' {
  class Client {
    constructor(config: any)
  }
  export = Client
}

declare module 'knex/lib/dialects/sqlite3/query/sqlite-querycompiler' {
  class SQLiteQueryCompiler {
    constructor(...args: any[])
  }
  export = SQLiteQueryCompiler
}

declare module 'knex/lib/dialects/sqlite3/schema/sqlite-compiler' {
  class SQLiteSchemaCompiler {
    constructor(...args: any[])
  }
  export = SQLiteSchemaCompiler
}

declare module 'knex/lib/dialects/sqlite3/schema/sqlite-columncompiler' {
  class SQLiteColumnCompiler {
    constructor(...args: any[])
  }
  export = SQLiteColumnCompiler
}

declare module 'knex/lib/dialects/sqlite3/schema/sqlite-tablecompiler' {
  class SQLiteTableCompiler {
    constructor(...args: any[])
  }
  export = SQLiteTableCompiler
}

declare module 'lodash/isEmpty' {
  function isEmpty(value: any): boolean
  export = isEmpty
}

declare module 'lodash/filter' {
  function filter<T>(collection: T[], predicate: any): T[]
  export = filter
}
