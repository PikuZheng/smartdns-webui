import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import detector from "i18next-browser-languagedetector";
import translationZhCN from '@/../public/locales/zh-CN/translation.json';

const resources = {
  "zh-CN": {
    translation: translationZhCN,
  }
};

// eslint-disable-next-line import/no-named-as-default-member
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

// eslint-disable-next-line unicorn/prefer-export-from
export default i18n;