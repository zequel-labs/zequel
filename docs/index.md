---
layout: home

hero:
  name: Zequel
  text: Modern Database Management
  tagline: An open-source database management GUI for PostgreSQL, MySQL, MariaDB, SQLite, MongoDB, Redis, and ClickHouse.
  image:
    src: /screenshots/table-view.png
    alt: Zequel - Data Grid
  actions:
    - theme: brand
      text: Get Started
      link: /guide/
    - theme: alt
      text: Download
      link: /download

features:
  - title: Multi-Database Support
    details: Connect to all your databases from a single application. Manage everything in one place.
  - title: Intelligent Query Editor
    details: Write and execute queries with a Monaco-based editor featuring syntax highlighting, autocompletion, and multi-tab support. Results appear instantly in a virtual-scrolled grid.
  - title: Visual Data Grid
    details: Browse, sort, and filter table data in a high-performance virtual-scrolled grid. Edit cell values inline and commit changes directly to the database.
  - title: Schema Management
    details: Explore database schemas with an interactive tree view. Visualize table relationships with auto-generated ER diagrams. Inspect columns, indexes, and constraints at a glance.
  - title: Secure Connections
    details: Connect safely with SSH tunneling and SSL/TLS encryption. Credentials are stored securely on your machine and never leave your device.
  - title: Cross-Platform
    details: Available on macOS (Intel and Apple Silicon), Windows, and Linux. Automatic updates keep you on the latest version with zero effort.
---

<div class="db-logos">
  <div class="db-logo"><img src="/postgresql.svg" alt="PostgreSQL" /><span>PostgreSQL</span></div>
  <div class="db-logo"><img src="/mysql.svg" alt="MySQL" /><span>MySQL</span></div>
  <div class="db-logo"><img src="/mariadb.svg" alt="MariaDB" /><span>MariaDB</span></div>
  <div class="db-logo"><img src="/sqlite.svg" alt="SQLite" /><span>SQLite</span></div>
  <div class="db-logo"><img src="/mongodb.svg" alt="MongoDB" /><span>MongoDB</span></div>
  <div class="db-logo"><img src="/redis.svg" alt="Redis" /><span>Redis</span></div>
  <div class="db-logo"><img src="/clickhouse.svg" alt="ClickHouse" /><span>ClickHouse</span></div>
</div>

## Screenshots

<div class="screenshots">
  <figure>
    <img src="/screenshots/table-view.png" alt="Data Grid" />
    <figcaption>Browse and edit table data with the virtual-scrolled data grid</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/table-structure.png" alt="Table Structure" />
    <figcaption>Inspect columns, indexes, and foreign keys at a glance</figcaption>
  </figure>
  <figure>
    <img src="/screenshots/er-diagram.png" alt="ER Diagram" />
    <figcaption>Visualize table relationships with auto-generated ER diagrams</figcaption>
  </figure>
</div>

<style>
.VPHero .container {
  max-width: var(--vp-layout-max-width) !important;
  margin: 0 auto !important;
  padding: 0 24px !important;
}
.VPHero .main {
  max-width: 50% !important;
  flex-shrink: 0;
}
.VPFeatures .container {
  max-width: var(--vp-layout-max-width) !important;
  margin: 0 auto !important;
  padding: 0 24px !important;
}
.vp-doc.container {
  max-width: var(--vp-layout-max-width) !important;
  margin: 0 auto !important;
  padding: 0 24px !important;
}
.VPHero .image-container {
  display: flex !important;
  justify-content: flex-end !important;
}
.VPHero .image-container .image-src {
  max-width: 680px !important;
  max-height: 680px !important;
  border-radius: 12px;
}
.screenshots {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 24px;
}
.screenshots figure {
  margin: 0;
}
.screenshots img {
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
}
.screenshots figcaption {
  text-align: center;
  margin-top: 12px;
  color: var(--vp-c-text-2);
  font-size: 14px;
}
.db-logos {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 32px;
  margin-top: 24px;
  margin-bottom: 48px;
}
.db-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.db-logo img {
  width: 56px;
  height: 56px;
  transition: transform 0.2s;
}
.db-logo img:hover {
  transform: scale(1.15);
}
.db-logo span {
  font-size: 13px;
  color: var(--vp-c-text-2);
  font-weight: 500;
}
</style>
