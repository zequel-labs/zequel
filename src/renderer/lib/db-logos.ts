import postgresqlLogo from '@/assets/images/postgresql.svg'
import mysqlLogo from '@/assets/images/mysql.svg'
import mariadbLogo from '@/assets/images/mariadb.svg'
import mongodbLogo from '@/assets/images/mongodb.svg'
import redisLogo from '@/assets/images/redis.svg'
import sqliteLogo from '@/assets/images/sqlite.svg'
import clickhouseLogo from '@/assets/images/clickhouse.svg'

const DB_LOGOS: Record<string, string> = {
  postgresql: postgresqlLogo,
  mysql: mysqlLogo,
  mariadb: mariadbLogo,
  mongodb: mongodbLogo,
  redis: redisLogo,
  sqlite: sqliteLogo,
  clickhouse: clickhouseLogo,
}

export function getDbLogo(type: string): string | undefined {
  return DB_LOGOS[type]
}
