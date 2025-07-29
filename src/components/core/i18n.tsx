import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import detector from "i18next-browser-languagedetector";
import translationZhCN from '@/../public/locales/zh-CN/translation.json';

const resources = {
  "zh-CN": {
    translation: translationZhCN,
  }
};

const i18n = createInstance();

void i18n
  .use(detector)
  .use(initReactI18next)
  .init({
    resources,
    debug: false,
    fallbackLng: "en",
    keySeparator: false,
    nsSeparator: false, 
    interpolation: {
      escapeValue: false
    },

  });

export default i18n;