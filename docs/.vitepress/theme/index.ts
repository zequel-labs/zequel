import DefaultTheme from 'vitepress/theme';
import PlatformLogos from './PlatformLogos.vue';
import DownloadPage from './DownloadPage.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('PlatformLogos', PlatformLogos);
    app.component('DownloadPage', DownloadPage);
  },
};
