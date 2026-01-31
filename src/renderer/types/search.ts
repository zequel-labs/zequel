export enum SearchResultType {
  Table = 'table',
  View = 'view',
  Query = 'query',
  SavedQuery = 'saved_query',
  Bookmark = 'bookmark',
  Column = 'column',
  Recent = 'recent',
}

export interface SearchResult {
  id: string
  type: SearchResultType
  name: string
  detail?: string
  connectionId?: string
  database?: string
  schema?: string
  sql?: string
  tableName?: string
}
