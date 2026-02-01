import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Zequel',
  description: 'A modern database management GUI for macOS, Windows, and Linux',
  base: '/zequel/',

  head: [
    ['link', { rel: 'icon', href: '/zequel/favicon.ico' }],
  ],

  themeConfig: {
    logo: '/logo.png',

    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'Databases', link: '/databases/' },
      { text: 'Contributing', link: '/contributing/' },
      {
        text: 'Download',
        link: 'https://github.com/zequelhq/zequel/releases/latest',
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Interface Overview', link: '/guide/interface-overview' },
          ],
        },
        {
          text: 'Connections',
          collapsed: false,
          items: [
            { text: 'Creating a Connection', link: '/guide/connections/' },
            { text: 'Import from URL', link: '/guide/connections/import-url' },
            { text: 'SSH Tunnels', link: '/guide/connections/ssh-tunnels' },
            { text: 'SSL / TLS', link: '/guide/connections/ssl-tls' },
            { text: 'Connection Folders', link: '/guide/connections/folders' },
            { text: 'Testing Connections', link: '/guide/connections/testing' },
            { text: 'Managing Databases', link: '/guide/connections/databases' },
          ],
        },
        {
          text: 'Query Editor',
          collapsed: false,
          items: [
            { text: 'Writing Queries', link: '/guide/querying/' },
            { text: 'Executing Queries', link: '/guide/querying/executing' },
            { text: 'Query Results', link: '/guide/querying/results' },
            { text: 'Formatting SQL', link: '/guide/querying/formatting' },
            { text: 'Saved Queries', link: '/guide/querying/saved-queries' },
            { text: 'Query History', link: '/guide/querying/history' },
            { text: 'Query Plans', link: '/guide/querying/query-plans' },
          ],
        },
        {
          text: 'Tables',
          collapsed: false,
          items: [
            { text: 'Browsing Data', link: '/guide/tables/' },
            { text: 'Editing Rows', link: '/guide/tables/editing-rows' },
            { text: 'Columns', link: '/guide/tables/columns' },
            { text: 'Indexes', link: '/guide/tables/indexes' },
            { text: 'Foreign Keys', link: '/guide/tables/foreign-keys' },
            { text: 'Creating Tables', link: '/guide/tables/creating' },
            { text: 'Renaming & Dropping', link: '/guide/tables/rename-drop' },
            { text: 'Table Info', link: '/guide/tables/info' },
          ],
        },
        {
          text: 'Views',
          collapsed: false,
          items: [
            { text: 'Managing Views', link: '/guide/views/' },
            { text: 'Creating & Editing', link: '/guide/views/creating-editing' },
            { text: 'Materialized Views', link: '/guide/views/materialized' },
          ],
        },
        {
          text: 'Import & Export',
          collapsed: false,
          items: [
            { text: 'Exporting Data', link: '/guide/import-export/' },
            { text: 'Importing Data', link: '/guide/import-export/importing' },
            { text: 'Supported Formats', link: '/guide/import-export/formats' },
            { text: 'Backup & Restore', link: '/guide/import-export/backup' },
          ],
        },
        {
          text: 'Schema Objects',
          collapsed: true,
          items: [
            { text: 'ER Diagrams', link: '/guide/er-diagrams' },
            { text: 'Routines', link: '/guide/routines' },
            { text: 'Triggers', link: '/guide/triggers' },
            { text: 'Sequences', link: '/guide/sequences' },
            { text: 'Enums', link: '/guide/enums' },
            { text: 'Events', link: '/guide/events' },
            { text: 'Extensions', link: '/guide/extensions' },
          ],
        },
        {
          text: 'Tools & Settings',
          collapsed: true,
          items: [
            { text: 'Monitoring', link: '/guide/monitoring' },
            { text: 'Users', link: '/guide/users' },
            { text: 'Bookmarks', link: '/guide/bookmarks' },
            { text: 'Settings', link: '/guide/settings' },
            { text: 'Keyboard Shortcuts', link: '/guide/keyboard-shortcuts' },
            { text: 'Command Palette', link: '/guide/command-palette' },
            { text: 'Auto Updates', link: '/guide/auto-updates' },
            { text: 'Troubleshooting', link: '/guide/troubleshooting' },
          ],
        },
      ],

      '/databases/': [
        {
          text: 'Database Guides',
          items: [
            { text: 'Feature Matrix', link: '/databases/' },
            { text: 'PostgreSQL', link: '/databases/postgresql' },
            { text: 'MySQL', link: '/databases/mysql' },
            { text: 'MariaDB', link: '/databases/mariadb' },
            { text: 'SQLite', link: '/databases/sqlite' },
            { text: 'MongoDB', link: '/databases/mongodb' },
            { text: 'Redis', link: '/databases/redis' },
            { text: 'ClickHouse', link: '/databases/clickhouse' },
          ],
        },
      ],

      '/contributing/': [
        {
          text: 'Contributing',
          items: [
            { text: 'How to Contribute', link: '/contributing/' },
            { text: 'Development Setup', link: '/contributing/development-setup' },
            { text: 'Project Structure', link: '/contributing/project-structure' },
            { text: 'Coding Guidelines', link: '/contributing/coding-guidelines' },
            { text: 'Database Adapters', link: '/contributing/database-adapters' },
            { text: 'IPC Architecture', link: '/contributing/ipc-architecture' },
            { text: 'Testing', link: '/contributing/testing' },
            { text: 'Connection URLs', link: '/contributing/connection-urls' },
            { text: 'Releasing', link: '/contributing/releasing' },
            { text: 'App Icons', link: '/contributing/app-icons' },
            { text: 'CI / CD', link: '/contributing/ci-cd' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/zequelhq/zequel' },
    ],

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/zequelhq/zequel/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the Elastic License 2.0.',
      copyright: 'Copyright &copy; 2025 Zequel',
    },
  },
});
