// src/i18n.ts  (English-only)
import i18n from "i18next";
import {initReactI18next} from "react-i18next";
import HttpBackend from "i18next-http-backend";
import {parse} from "yaml";
import {getBackendLoadPath} from "@/utils/dataMode";

export type LanguageCode = "en";
export const SUPPORTED_LANGUAGES: LanguageCode[] = ["en"];

i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    lng: "en",
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES,
    load: "languageOnly",

    ns: ["common", "maps", "types", "classes",
      "items/types", "items/items", "items/grades", "items/tiers"],
    defaultNS: "common",

    backend: {
      loadPath: getBackendLoadPath(),
      parse: (data: string) => parse(data),
    },

    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
