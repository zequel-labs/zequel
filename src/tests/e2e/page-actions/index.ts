import type { Page } from '@playwright/test'
import {
  selectDatabaseType,
  fillConnectionDetails,
  testConnection,
  disableSSL,
  enableTrustServerCertificate,
  connectToDatabase,
} from './connectionActions'
import {
  openCollection,
  openTable,
  editCell,
  editDateCell,
  deleteRow,
  applyChanges,
} from './gridActions'
import {
  addFilter,
  applyFilters,
  removeFilter,
  getRowCount,
  getRecordRange as getFilterRecordRange,
} from './filterActions'
import {
  switchSidebarTab,
  waitForSidebar,
  openTableByTestId,
  openCollectionByTestId,
  openRedisKey,
  pinTableByContextMenu,
  pinCollectionByContextMenu,
  unpinEntityByContextMenu,
} from './sidebarActions'
import {
  openQueryEditor,
  typeQuery,
  runQuery,
  runQueryWithKeyboard,
  formatQuery,
} from './queryActions'
import {
  switchToDataTab,
  switchToStructureTab,
  addRow,
  goToNextPage,
  goToPreviousPage,
  discardChanges,
  getRecordRange,
  clickExport,
} from './statusBarActions'
import {
  openMonitoring,
  openUserManagement,
  openBackup,
  openRestore,
  toggleSafeMode,
  enableSafeMode,
  disableSafeMode,
  isSafeModeEnabled,
} from './headerActions'

export const userActions = (page: Page) => ({
  // Connection
  selectDatabaseType: (type: string) => selectDatabaseType(page, type),
  fillConnectionDetails: (config: Parameters<typeof fillConnectionDetails>[1]) =>
    fillConnectionDetails(page, config),
  testConnection: () => testConnection(page),
  disableSSL: () => disableSSL(page),
  enableTrustServerCertificate: () => enableTrustServerCertificate(page),
  connectToDatabase: () => connectToDatabase(page),

  // Grid
  openCollection: (name: string) => openCollection(page, name),
  openTable: (name: string) => openTable(page, name),
  editCell: (rowIndex: number, columnId: string, newValue: string) =>
    editCell(page, rowIndex, columnId, newValue),
  editDateCell: (rowIndex: number, columnId: string) =>
    editDateCell(page, rowIndex, columnId),
  deleteRow: (rowIndex: number, columnId: string) =>
    deleteRow(page, rowIndex, columnId),
  applyChanges: () => applyChanges(page),

  // Filter
  addFilter: (column: string, operator: string, value?: string) =>
    addFilter(page, column, operator, value),
  applyFilters: () => applyFilters(page),
  removeFilter: (index: number) => removeFilter(page, index),
  getRowCount: () => getRowCount(page),

  // Sidebar
  switchSidebarTab: (tab: 'items' | 'queries' | 'history') =>
    switchSidebarTab(page, tab),
  waitForSidebar: () => waitForSidebar(page),
  openTableByTestId: (name: string) => openTableByTestId(page, name),
  openCollectionByTestId: (name: string) => openCollectionByTestId(page, name),
  openRedisKey: (name: string) => openRedisKey(page, name),
  pinTableByContextMenu: (name: string) => pinTableByContextMenu(page, name),
  pinCollectionByContextMenu: (name: string) => pinCollectionByContextMenu(page, name),
  unpinEntityByContextMenu: (name: string) => unpinEntityByContextMenu(page, name),

  // Query
  openQueryEditor: () => openQueryEditor(page),
  typeQuery: (sql: string) => typeQuery(page, sql),
  runQuery: () => runQuery(page),
  runQueryWithKeyboard: () => runQueryWithKeyboard(page),
  formatQuery: () => formatQuery(page),

  // Status bar
  switchToDataTab: () => switchToDataTab(page),
  switchToStructureTab: () => switchToStructureTab(page),
  addRow: () => addRow(page),
  goToNextPage: () => goToNextPage(page),
  goToPreviousPage: () => goToPreviousPage(page),
  discardChanges: () => discardChanges(page),
  getRecordRange: () => getRecordRange(page),
  clickExport: () => clickExport(page),

  // Header
  openMonitoring: () => openMonitoring(page),
  openUserManagement: () => openUserManagement(page),
  openBackup: () => openBackup(page),
  openRestore: () => openRestore(page),
  toggleSafeMode: () => toggleSafeMode(page),
  enableSafeMode: () => enableSafeMode(page),
  disableSafeMode: () => disableSafeMode(page),
  isSafeModeEnabled: () => isSafeModeEnabled(page),
})

export type UserActions = ReturnType<typeof userActions>
