import i18next from 'i18next';
import middleware from 'i18next-http-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function setupI18n() {
  const Backend = (await import('i18next-fs-backend')).default;
  await i18next
    .use(Backend)
    .use(middleware.LanguageDetector)
    .init({
      fallbackLng: 'en',
      preload: ['en', 'sv', 'fi', 'no', 'lv', 'et', 'lt', 'da'],
      backend: {
        loadPath: path.join(__dirname, './locales/{{lng}}/translation.json'),
      },
      detection: {
        order: ['cookie', 'querystring', 'header'],
        caches: ['cookie'],
      },
      debug: false,
    });
}
