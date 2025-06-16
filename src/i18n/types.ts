/**
 * Type definitions for internationalization
 */

/**
 * Supported language codes
 */
export type SupportedLanguage = 'en' | 'zh-cn';

/**
 * Language preference options
 */
export type LanguagePreference = 'auto' | SupportedLanguage;

/**
 * Localization resource structure
 */
export interface LocalizationResources {
    [key: string]: string;
}

/**
 * i18n configuration interface
 */
export interface I18nConfig {
    language: LanguagePreference;
    fallbackLanguage: SupportedLanguage;
}

/**
 * Message formatter function type
 */
export type MessageFormatter = (...args: (string | number)[]) => string; 