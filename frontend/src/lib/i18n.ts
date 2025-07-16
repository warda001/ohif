import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

// Import translation files
import enTranslations from '@/locales/en/common.json';
import esTranslations from '@/locales/es/common.json';
import frTranslations from '@/locales/fr/common.json';
import deTranslations from '@/locales/de/common.json';
import itTranslations from '@/locales/it/common.json';
import ptTranslations from '@/locales/pt/common.json';
import zhTranslations from '@/locales/zh/common.json';
import jaTranslations from '@/locales/ja/common.json';
import koTranslations from '@/locales/ko/common.json';
import arTranslations from '@/locales/ar/common.json';
import heTranslations from '@/locales/he/common.json';
import ruTranslations from '@/locales/ru/common.json';
import hiTranslations from '@/locales/hi/common.json';

// Define supported languages
export const SUPPORTED_LANGUAGES = {
  en: {
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    rtl: false,
    dateFormat: 'MM/DD/YYYY',
    timeFormat: 'h:mm A',
    numberFormat: 'en-US',
  },
  es: {
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    rtl: false,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    numberFormat: 'es-ES',
  },
  fr: {
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    rtl: false,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    numberFormat: 'fr-FR',
  },
  de: {
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    rtl: false,
    dateFormat: 'DD.MM.YYYY',
    timeFormat: 'HH:mm',
    numberFormat: 'de-DE',
  },
  it: {
    name: 'Italian',
    nativeName: 'Italiano',
    flag: '🇮🇹',
    rtl: false,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    numberFormat: 'it-IT',
  },
  pt: {
    name: 'Portuguese',
    nativeName: 'Português',
    flag: '🇵🇹',
    rtl: false,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    numberFormat: 'pt-PT',
  },
  zh: {
    name: 'Chinese',
    nativeName: '中文',
    flag: '🇨🇳',
    rtl: false,
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm',
    numberFormat: 'zh-CN',
  },
  ja: {
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    rtl: false,
    dateFormat: 'YYYY/MM/DD',
    timeFormat: 'HH:mm',
    numberFormat: 'ja-JP',
  },
  ko: {
    name: 'Korean',
    nativeName: '한국어',
    flag: '🇰🇷',
    rtl: false,
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm',
    numberFormat: 'ko-KR',
  },
  ar: {
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    rtl: true,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    numberFormat: 'ar-SA',
  },
  he: {
    name: 'Hebrew',
    nativeName: 'עברית',
    flag: '🇮🇱',
    rtl: true,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    numberFormat: 'he-IL',
  },
  ru: {
    name: 'Russian',
    nativeName: 'Русский',
    flag: '🇷🇺',
    rtl: false,
    dateFormat: 'DD.MM.YYYY',
    timeFormat: 'HH:mm',
    numberFormat: 'ru-RU',
  },
  hi: {
    name: 'Hindi',
    nativeName: 'हिन्दी',
    flag: '🇮🇳',
    rtl: false,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    numberFormat: 'hi-IN',
  },
};

// Resources object
const resources = {
  en: { common: enTranslations },
  es: { common: esTranslations },
  fr: { common: frTranslations },
  de: { common: deTranslations },
  it: { common: itTranslations },
  pt: { common: ptTranslations },
  zh: { common: zhTranslations },
  ja: { common: jaTranslations },
  ko: { common: koTranslations },
  ar: { common: arTranslations },
  he: { common: heTranslations },
  ru: { common: ruTranslations },
  hi: { common: hiTranslations },
};

// Initialize i18n
i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    debug: process.env.NODE_ENV === 'development',
    
    // Language detection options
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      checkWhitelist: true,
    },

    // Interpolation options
    interpolation: {
      escapeValue: false,
      formatSeparator: ',',
      format: function(value, format, lng) {
        const language = SUPPORTED_LANGUAGES[lng as keyof typeof SUPPORTED_LANGUAGES];
        
        if (format === 'uppercase') return value.toUpperCase();
        if (format === 'lowercase') return value.toLowerCase();
        if (format === 'capitalize') return value.charAt(0).toUpperCase() + value.slice(1);
        
        // Date formatting
        if (format === 'date') {
          return new Date(value).toLocaleDateString(language?.numberFormat || 'en-US');
        }
        
        // Time formatting
        if (format === 'time') {
          return new Date(value).toLocaleTimeString(language?.numberFormat || 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
          });
        }
        
        // Number formatting
        if (format === 'number') {
          return new Intl.NumberFormat(language?.numberFormat || 'en-US').format(value);
        }
        
        // Currency formatting
        if (format === 'currency') {
          return new Intl.NumberFormat(language?.numberFormat || 'en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(value);
        }
        
        return value;
      },
    },

    // Whitelist supported languages
    supportedLngs: Object.keys(SUPPORTED_LANGUAGES),
    whitelist: Object.keys(SUPPORTED_LANGUAGES),

    // Namespace configuration
    ns: ['common'],

    // Backend options (for loading translations from server)
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },

    // React options
    react: {
      useSuspense: false,
      bindI18n: 'languageChanged',
      bindI18nStore: '',
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'em', 'span'],
    },
  });

// Helper functions
export const getCurrentLanguage = () => i18n.language;
export const isRTL = () => SUPPORTED_LANGUAGES[i18n.language as keyof typeof SUPPORTED_LANGUAGES]?.rtl || false;
export const getLanguageInfo = (lng?: string) => SUPPORTED_LANGUAGES[(lng || i18n.language) as keyof typeof SUPPORTED_LANGUAGES];

// Format utilities
export const formatDate = (date: Date | string, lng?: string) => {
  const language = lng || i18n.language;
  const info = SUPPORTED_LANGUAGES[language as keyof typeof SUPPORTED_LANGUAGES];
  return new Date(date).toLocaleDateString(info?.numberFormat || 'en-US');
};

export const formatTime = (date: Date | string, lng?: string) => {
  const language = lng || i18n.language;
  const info = SUPPORTED_LANGUAGES[language as keyof typeof SUPPORTED_LANGUAGES];
  return new Date(date).toLocaleTimeString(info?.numberFormat || 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatNumber = (num: number, lng?: string) => {
  const language = lng || i18n.language;
  const info = SUPPORTED_LANGUAGES[language as keyof typeof SUPPORTED_LANGUAGES];
  return new Intl.NumberFormat(info?.numberFormat || 'en-US').format(num);
};

export const formatCurrency = (amount: number, currency = 'USD', lng?: string) => {
  const language = lng || i18n.language;
  const info = SUPPORTED_LANGUAGES[language as keyof typeof SUPPORTED_LANGUAGES];
  return new Intl.NumberFormat(info?.numberFormat || 'en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export default i18n;