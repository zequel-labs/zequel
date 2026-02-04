<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  IconBrandAppleFilled,
  IconBrandWindowsFilled,
  IconBrandUbuntu,
  IconDownload,
} from '@tabler/icons-vue';

const REPO = 'zequel-labs/zequel';
const RELEASES_URL = `https://github.com/${REPO}/releases`;

interface Asset {
  name: string;
  browser_download_url: string;
}

interface Release {
  tag_name: string;
  assets: Asset[];
}

const release = ref<Release | null>(null);
const assetUrl = (pattern: RegExp): string | null => {
  const asset = release.value?.assets.find((a) => pattern.test(a.name));
  return asset?.browser_download_url ?? null;
};

const macArm64Url = computed(() => assetUrl(/apple-silicon\.zip$/i));
const macIntelUrl = computed(() => assetUrl(/apple-intel\.zip$/i));
const windowsX64Url = computed(() => assetUrl(/window-x64\.exe$/i));
const windowsArm64Url = computed(() => assetUrl(/window-arm64\.exe$/i));
const linuxX64Url = computed(() => assetUrl(/linux-x64\.AppImage$/i));
const linuxArm64Url = computed(() => assetUrl(/linux-arm64\.AppImage$/i));

const fallback = `${RELEASES_URL}/latest`;

onMounted(async () => {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (res.ok) {
      release.value = await res.json();
    }
  } catch {
    // silent — buttons fall back to releases page
  }
});
</script>

<template>
  <div class="download-page">
    <div class="download-hero">
      <h1>Download Zequel Free For macOS, Linux, Or Windows</h1>
      <p>A modern, open-source database management tool. Connect to PostgreSQL, MySQL, SQLite, MongoDB, Redis, and more.</p>
    </div>

    <div class="download-grid">
      <!-- macOS -->
      <div class="download-row">
        <div class="platform-label">
          <IconBrandAppleFilled :size="32" />
          <span>macOS</span>
        </div>
        <div class="download-buttons">
          <a :href="macArm64Url ?? fallback" class="download-btn">
            <IconDownload :size="18" />
            <span class="btn-label">Apple Silicon</span>
          </a>
          <a :href="macIntelUrl ?? fallback" class="download-btn">
            <IconDownload :size="18" />
            <span class="btn-label">Intel</span>
          </a>
        </div>
      </div>

      <!-- Windows -->
      <div class="download-row">
        <div class="platform-label">
          <IconBrandWindowsFilled :size="32" />
          <span>Windows</span>
        </div>
        <div class="download-buttons">
          <a :href="windowsX64Url ?? fallback" class="download-btn">
            <IconDownload :size="18" />
            <span class="btn-label">Installer</span>
            <span class="btn-arch">x64</span>
          </a>
          <a :href="windowsArm64Url ?? fallback" class="download-btn">
            <IconDownload :size="18" />
            <span class="btn-label">Installer</span>
            <span class="btn-arch">arm64</span>
          </a>
        </div>
      </div>

      <!-- Linux -->
      <div class="download-row">
        <div class="platform-label">
          <IconBrandUbuntu :size="32" stroke-width="2" />
          <span>Linux</span>
        </div>
        <div class="download-buttons">
          <a :href="linuxX64Url ?? fallback" class="download-btn">
            <IconDownload :size="18" />
            <span class="btn-label">AppImage</span>
            <span class="btn-arch">x86_64</span>
          </a>
          <a :href="linuxArm64Url ?? fallback" class="download-btn">
            <IconDownload :size="18" />
            <span class="btn-label">AppImage</span>
            <span class="btn-arch">arm64</span>
          </a>
        </div>
      </div>
    </div>

    <div class="download-footer">
      <p>
        By downloading you agree to the terms of the
        <a href="https://github.com/zequel-labs/zequel/blob/main/LICENSE" target="_blank">Elastic License 2.0</a>.
      </p>
      <p>
        <a :href="RELEASES_URL" target="_blank">View all releases on GitHub</a>
      </p>
    </div>
  </div>
</template>
