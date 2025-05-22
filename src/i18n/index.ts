import i18next from 'i18next';

const i18n = i18next.createInstance();

i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: { translation: require('./en.json') },
    sv: { translation: require('./sv.json') },
    fi: { translation: require('./fi.json') },
    no: { translation: require('./no.json') },
    lv: { translation: require('./lv.json') },
    et: { translation: require('./et.json') },
    lt: { translation: require('./lt.json') },
    da: { translation: require('./da.json') },
  },
});

export { i18n };
