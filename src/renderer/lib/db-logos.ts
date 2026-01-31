import { DatabaseType } from '@/types/connection'

import postgresqlLogo from '@/assets/images/postgresql.svg'
import mysqlLogo from '@/assets/images/mysql.svg'
import mariadbLogo from '@/assets/images/mariadb.svg'
import mongodbLogo from '@/assets/images/mongodb.svg'
import redisLogo from '@/assets/images/redis.svg'
import sqliteLogo from '@/assets/images/sqlite.svg'
import clickhouseLogo from '@/assets/images/clickhouse.svg'

const DB_LOGOS: Record<DatabaseType, string> = {
  [DatabaseType.PostgreSQL]: postgresqlLogo,
  [DatabaseType.MySQL]: mysqlLogo,
  [DatabaseType.MariaDB]: mariadbLogo,
  [DatabaseType.MongoDB]: mongodbLogo,
  [DatabaseType.Redis]: redisLogo,
  [DatabaseType.SQLite]: sqliteLogo,
  [DatabaseType.ClickHouse]: clickhouseLogo,
}

export const getDbLogo = (type: DatabaseType): string | undefined => {
  return DB_LOGOS[type]
}
