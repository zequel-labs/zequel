import type { Migration } from '@main/services/migrationRunner'
import { migration as m001 } from './001_create_connections'
import { migration as m002 } from './002_create_query_history'
import { migration as m003 } from './003_create_saved_queries'
import { migration as m004 } from './004_create_settings'
import { migration as m005 } from './005_create_recents'
import { migration as m006 } from './006_add_connections_ssh_config'
import { migration as m007 } from './007_add_connections_environment'
import { migration as m008 } from './008_add_connections_folder'
import { migration as m009 } from './009_add_connections_sort_order'
import { migration as m010 } from './010_create_pinned_entities'
import { migration as m011 } from './011_add_duckdb_type'

export const migrations: readonly Migration[] = [
  m001,
  m002,
  m003,
  m004,
  m005,
  m006,
  m007,
  m008,
  m009,
  m010,
  m011,
]
