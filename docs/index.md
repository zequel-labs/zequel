---
layout: home

hero:
  name: Zequel
  text: Modern Database Management
  tagline: An open-source GUI for PostgreSQL, MySQL, MariaDB, SQLite, MongoDB, Redis, and ClickHouse.
  image:
    src: /screenshots/table-view.png
    alt: Zequel - Data Grid
  actions:
    - theme: brand
      text: Get Started
      link: /guide/
    - theme: alt
      text: Download
      link: https://github.com/zequelhq/zequel/releases/latest
    - theme: alt
      text: GitHub
      link: https://github.com/zequelhq/zequel

features:
  - title: Multi-Database Support
    details: Connect to PostgreSQL, MySQL, MariaDB, SQLite, ClickHouse, MongoDB, and Redis from a single application. Manage all your databases in one place.
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
</div>

<style>
.VPHero .image-container .image-src {
  max-width: 680px !important;
  max-height: 680px !important;
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
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
</style>
