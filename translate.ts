/* eslint-disable no-restricted-syntax, guard-for-in, no-await-in-loop */
import * as fs from 'fs';
import { consola } from 'consola';
import { OpenAI } from 'openai';

const inputFilePath = 'dist/companies.json';
const translationsFilePath = 'dist/companies_i18n.json';
const defaultLanguage = 'en';
const defaultLanguageCount = 1;
const languages = [
    'ru',
    'de',
    'zh-cn',
];

const openai = new OpenAI();

interface Company {
    name: string;
    websiteUrl: string;
    description: string;
}

interface Companies {
    [key: string]: Company;
}

interface TranslationResult {
    [lang: string]: string;
}

interface Translations {
    [companyId: string]: TranslationResult;
}

async function translateContent(
    content: string,
    langCode: string,
    companyName?: string,
): Promise<string> {
    const nameInstruction = companyName
        ? ` Keep the company/brand name "${companyName}" in its original form — do not translate or transliterate it.`
        : '';
    const prompt = `Translate the following text to language with code ${langCode}.${nameInstruction} Output only the translated text, nothing else.\n${content}`;

    const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: 'You are a translation assistant. You translate company descriptions while keeping brand and company names in their original form.' },
            { role: 'user', content: prompt },
        ],
    });

    return completion.choices[0].message.content!;
}

async function detectLanguage(content: string): Promise<string> {
    const prompt = `What language is the following text written in? Respond with a single ISO 639-1 language code (e.g. "en", "zh", "de"). Output only the language code, nothing else.\n${content}`;

    const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: 'You are a language detection assistant. You respond with a single ISO 639-1 language code.' },
            { role: 'user', content: prompt },
        ],
    });

    return completion.choices[0].message.content!.trim().toLowerCase();
}

async function translateToEnglish(
    content: string,
    companyName?: string,
): Promise<string> {
    const nameInstruction = companyName
        ? ` Keep the company/brand name "${companyName}" in its original form — do not translate or transliterate it.`
        : '';
    const prompt = `Translate the following text to English.${nameInstruction} Output only the translated text, nothing else.\n${content}`;

    const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: 'You are a translation assistant. You translate company descriptions while keeping brand and company names in their original form.' },
            { role: 'user', content: prompt },
        ],
    });

    return completion.choices[0].message.content!.trim();
}

function initTranslations(companies: Companies): Translations {
    const translations: Translations = {};

    // Init translations with english default strings for now.
    for (const companyId in companies) {
        const company = companies[companyId];

        if (company.description) {
            const companyTranslations: TranslationResult = {};
            companyTranslations[defaultLanguage] = company.description;
            translations[companyId] = companyTranslations;
        }
    }

    return translations;
}

function copyBaseDescriptionToAllLang(
    translations: TranslationResult,
    description: string,
) : TranslationResult {
    const newtranslations = { ...translations };
    for (const lang of languages) {
        newtranslations[lang] = description;
    }

    return newtranslations;
}

function isStringNullOrEmpty(value: string | null | undefined) : boolean {
    return value === null || value === undefined || value.trim() === '';
}

function isStringNumeric(value: string | null | undefined) : boolean {
    return !Number.isNaN(Number(value));
}

function isDescriptionNeedToTranslate(value: string | null | undefined) : boolean {
    return !isStringNullOrEmpty(value)
        && !isStringNumeric(value);
}

/**
 * Validates a translation result for forbidden characters.
 * Returns an error message string if invalid, or null if valid.
 */
function validateTranslationResult(text: string, companyId: string, lang: string): string | null {
    // Check for control characters (except \n, \r, \t)
    // eslint-disable-next-line no-control-regex
    const forbiddenCharsMatch = text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g);
    if (forbiddenCharsMatch) {
        const chars = forbiddenCharsMatch.map((c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(', ');
        return `Company ${companyId} lang ${lang}: forbidden control characters [${chars}]`;
    }

    return null;
}

/**
 * Validates that every company has translations for all target languages.
 * Returns a list of error messages for missing entries.
 */
function validateCompleteness(translations: Translations): string[] {
    const errors: string[] = [];
    for (const companyId in translations) {
        const companyTranslations = translations[companyId];
        for (const lang of languages) {
            if (companyTranslations[lang] === undefined || companyTranslations[lang] === null) {
                errors.push(`Company ${companyId}: missing translation for language ${lang}`);
            }
        }
    }

    return errors;
}

function removeObsoleteCompanyDescriptions(translations: Translations, companies: Companies) {
    const syncedTranslations = translations;

    // Remove translations of companies that are no more present in the
    // companies object.
    for (const companyId in translations) {
        const company = companies[companyId];
        if (!company || !company.description) {
            consola.info(`Removing translations for company ${companyId} as it doesn't exist anymore`);
            delete syncedTranslations[companyId];
        }
    }
}

async function generateTranslations(
    companyTranslations: TranslationResult,
    baseDescriptionChanged: boolean,
    companyId: string,
    companyName: string,
    englishDescription: string,
    errors: string[],
) : Promise<TranslationResult> {
    const newCompanyTranslations = { ...companyTranslations };
    // If there are no translations for this company, generate them.
    for (const lang of languages) {
        // Only translate it if there's a language missing or if the
        // base description changed.
        if (baseDescriptionChanged || newCompanyTranslations[lang] === undefined) {
            try {
                consola.debug(`Translating ${companyId} description to ${lang}`);
                const translatedText = await translateContent(englishDescription, lang, companyName);
                const validationError = validateTranslationResult(translatedText, companyId, lang);
                if (validationError) {
                    errors.push(validationError);
                    consola.error(validationError);
                } else {
                    newCompanyTranslations[lang] = translatedText;
                }
            } catch (ex) {
                const errorMsg = `Failed to translate ${companyId} description to ${lang}: ${ex}`;
                errors.push(errorMsg);
                consola.error(errorMsg);
            }
        }
    }

    return newCompanyTranslations;
}

async function translateCompanyDescriptions(translations: Translations, companies: Companies) {
    const syncedTranslations = translations;
    let translatedCompaniesCount = 0;
    let translationsCount = 0;
    let previousTranslationsCount = 0;
    const errors: string[] = [];

    consola.info('Start translate company descriptions');
    // Sync translations with the companies object.

    const companyIds = Object.keys(companies);
    const totalCompanies = companyIds.length;
    let processedCount = 0;

    for (const companyId of companyIds) {
        processedCount += 1;
        const company = companies[companyId];
        const originalDescription = company.description;
        let companyTranslations = syncedTranslations[companyId] ?? {
            [defaultLanguage]: originalDescription,
        };
        const baseDescriptionChanged = companyTranslations[defaultLanguage] !== originalDescription;

        if (!isDescriptionNeedToTranslate(company.description)) {
            consola.info(`[${processedCount}/${totalCompanies}] ${companyId}: skipping (empty or numeric description)`);
            companyTranslations[defaultLanguage] = originalDescription;
            companyTranslations = copyBaseDescriptionToAllLang(
                companyTranslations,
                company.description,
            );
        } else {
            // If the source description changed or there's no English translation yet,
            // detect if it's non-English and translate to English first.
            let englishDescription = companyTranslations[defaultLanguage];
            if (baseDescriptionChanged || englishDescription === originalDescription) {
                consola.info(`[${processedCount}/${totalCompanies}] ${companyId}: detecting language...`);
                try {
                    const detectedLang = await detectLanguage(originalDescription);
                    if (detectedLang !== 'en') {
                        consola.info(`[${processedCount}/${totalCompanies}] ${companyId}: source language is "${detectedLang}", translating to English...`);
                        englishDescription = await translateToEnglish(originalDescription, company.name);
                    } else {
                        consola.info(`[${processedCount}/${totalCompanies}] ${companyId}: source is already English`);
                        englishDescription = originalDescription;
                    }
                } catch (ex) {
                    const errorMsg = `Failed to translate ${companyId} description to English: ${ex}`;
                    errors.push(errorMsg);
                    consola.error(errorMsg);
                    englishDescription = originalDescription;
                }
            }

            // Update the English base.
            companyTranslations[defaultLanguage] = englishDescription;

            const missingLangs = languages.filter((lang) => companyTranslations[lang] === undefined);
            if (!baseDescriptionChanged && missingLangs.length === 0) {
                consola.info(`[${processedCount}/${totalCompanies}] ${companyId}: all translations up to date`);
            } else {
                consola.info(`[${processedCount}/${totalCompanies}] ${companyId}: translating to ${baseDescriptionChanged ? languages.length : missingLangs.length} languages...`);
            }

            companyTranslations = await generateTranslations(
                companyTranslations,
                baseDescriptionChanged,
                companyId,
                company.name,
                englishDescription,
                errors,
            );
            translationsCount += Object.keys(companyTranslations).length - defaultLanguageCount;
        }

        // Signals that there were changes in company translations.
        if (translationsCount !== previousTranslationsCount) {
            translatedCompaniesCount += 1;
            previousTranslationsCount = translationsCount;
        }

        // Update translations for this company.
        syncedTranslations[companyId] = companyTranslations;

        // Save the updated result to the file once in a while since the script
        // may run for a long time and we don't want to lose intermediate
        // result.
        if (translatedCompaniesCount > 0 && translatedCompaniesCount % 10 === 0) {
            consola.info(`Made ${translationsCount} translations in ${translatedCompaniesCount} companies, saving to ${translationsFilePath}`);
            fs.writeFileSync(translationsFilePath, JSON.stringify(syncedTranslations, null, 4));
        }
    }

    return errors;
}

async function syncTranslations(translations: Translations, companies: Companies) {
    removeObsoleteCompanyDescriptions(translations, companies);
    const errors = await translateCompanyDescriptions(translations, companies);
    return errors;
}

async function main() {
    consola.info('Start translating companies description');

    const rawData = fs.readFileSync(inputFilePath, 'utf-8');
    const parsedData = JSON.parse(rawData);
    const { companies } = parsedData;

    consola.info(`Found ${Object.keys(companies).length} companies in ${inputFilePath}`);

    // First, prepare the translations file.
    let translations: Translations;

    if (!fs.existsSync(translationsFilePath)) {
        consola.info(`Prepare the initial i18n file at ${translationsFilePath}`);

        // Prepare a translations file if there's nothing yet.
        translations = initTranslations(companies);
        fs.writeFileSync(translationsFilePath, JSON.stringify(translations, null, 4));
    } else {
        consola.info(`Reading existing i18n file at ${translationsFilePath}`);

        const rawTranslations = fs.readFileSync(translationsFilePath, 'utf-8');
        translations = JSON.parse(rawTranslations);
    }

    consola.info(`Found ${Object.keys(translations).length} companies in ${translationsFilePath}`);

    const syncErrors = await syncTranslations(translations, companies);

    // Save final result
    fs.writeFileSync(translationsFilePath, JSON.stringify(translations, null, 4));
    consola.info(`Translations saved to ${translationsFilePath}`);

    // Validate completeness
    const completenessErrors = validateCompleteness(translations);
    const allErrors = [...syncErrors, ...completenessErrors];

    // Print summary report
    consola.info(`\n=== Translation Summary ===`);
    consola.info(`Total companies processed: ${Object.keys(translations).length}`);
    consola.info(`Target languages: ${languages.length}`);
    if (allErrors.length === 0) {
        consola.info('All validations passed. No errors.');
    } else {
        consola.warn(`Encountered ${allErrors.length} error(s):`);
        for (const error of allErrors) {
            consola.error(error);
        }
    }
}

main();
