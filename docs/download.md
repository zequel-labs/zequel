---
layout: page
title: Download
---

<DownloadPage />

<style>
.download-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 24px 64px;
}
.download-hero {
  text-align: center;
  margin-bottom: 48px;
}
.download-hero h1 {
  font-size: 36px;
  font-weight: 700;
  line-height: 1.3;
  padding-bottom: 4px;
  background: linear-gradient(135deg, var(--vp-c-brand-1), var(--vp-c-tip-1, #27AAE1));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0 0 8px;
}
.download-hero p {
  font-size: 18px;
  color: var(--vp-c-text-2);
  margin: 0 0 16px;
}
.download-loading,
.download-error {
  text-align: center;
  padding: 48px 0;
  color: var(--vp-c-text-2);
  font-size: 15px;
}
.fallback-link {
  display: inline-block;
  margin-top: 16px;
  padding: 10px 24px;
  color: #fff;
  background: var(--vp-c-brand-1);
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
}
.fallback-link:hover {
  background: var(--vp-c-brand-2);
}
.download-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
}
.download-row {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 24px 32px;
  border-bottom: 1px solid var(--vp-c-divider);
}
.download-row:last-child {
  border-bottom: none;
}
.platform-label {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 160px;
  color: var(--vp-c-text-1);
  font-size: 20px;
  font-weight: 600;
  flex-shrink: 0;
}
.download-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  flex: 1;
}
.download-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  text-decoration: none;
  font-weight: 500;
  font-size: 14px;
  transition: background 0.2s, transform 0.15s;
  border: 1px solid transparent;
}
.download-btn:hover {
  background: var(--vp-c-brand-1);
  color: #fff;
  transform: translateY(-1px);
}
.btn-label {
  font-weight: 600;
}
.btn-arch {
  font-size: 12px;
  opacity: 0.7;
  font-weight: 400;
}
.download-footer {
  text-align: center;
  margin-top: 32px;
  font-size: 13px;
  color: var(--vp-c-text-3);
}
.download-footer a {
  color: var(--vp-c-brand-1);
  text-decoration: none;
}
.download-footer a:hover {
  text-decoration: underline;
}
.download-footer p {
  margin: 8px 0;
}
@media (max-width: 640px) {
  .download-page {
    padding: 32px 16px 48px;
  }
  .download-hero h1 {
    font-size: 24px;
  }
  .download-hero p {
    font-size: 15px;
  }
  .download-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 20px 20px;
  }
  .platform-label {
    min-width: auto;
    font-size: 18px;
  }
  .download-buttons {
    width: 100%;
  }
  .download-btn {
    flex: 1;
    justify-content: center;
  }
}
</style>
