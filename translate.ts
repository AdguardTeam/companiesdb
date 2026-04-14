/* eslint-disable no-restricted-syntax, guard-for-in, no-await-in-loop */
import * as fs from 'fs';
import * as crypto from 'crypto';
import { consola } from 'consola';
import { OpenAI } from 'openai';

const inputFilePath = 'dist/companies.json';
const translationsFilePath = 'dist/companies_i18n.json';
const languages = [
    'en',
    'de',
    'zh-cn',
    'ru',
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

// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
interface TranslationResult {
    // MD5 hash of the original description, used to detect changes between runs.
    sourceHash?: string;
    [lang: string]: string | undefined;
}

function hashDescription(description: string | null | undefined): string {
    if (!description) {
        return '';
    }

    return crypto.createHash('md5').update(description).digest('hex');
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
            {
                role: 'system',
                content: 'You are a translation assistant. You translate company descriptions'
                    + ' while keeping brand and company names in their original form.',
            },
            { role: 'user', content: prompt },
        ],
    });

    return completion.choices[0].message.content!;
}

function copySourceToAllLang(
    translations: TranslationResult,
    sourceDescription: string,
): TranslationResult {
    const result = { ...translations };
    result.sourceHash = hashDescription(sourceDescription);
    for (const lang of languages) {
        result[lang] = sourceDescription;
    }

    return result;
}

function isStringNullOrEmpty(value: string | null | undefined): boolean {
    return value === null || value === undefined || value.trim() === '';
}

function isStringNumeric(value: string | null | undefined): boolean {
    return !Number.isNaN(Number(value));
}

function isDescriptionNeedToTranslate(value: string | null | undefined): boolean {
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
        const chars = forbiddenCharsMatch
            .map((c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
            .join(', ');
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
    sourceChanged: boolean,
    companyId: string,
    companyName: string,
    sourceDescription: string,
    errors: string[],
): Promise<TranslationResult> {
    const result: TranslationResult = { ...companyTranslations };
    result.sourceHash = hashDescription(sourceDescription);

    for (const lang of languages) {
        if (sourceChanged || result[lang] === undefined) {
            try {
                consola.debug(`Translating ${companyId} to ${lang}`);
                const translatedText = await translateContent(
                    sourceDescription,
                    lang,
                    companyName,
                );
                const validationError = validateTranslationResult(translatedText, companyId, lang);
                if (validationError) {
                    errors.push(validationError);
                    consola.error(validationError);
                } else {
                    result[lang] = translatedText;
                }
            } catch (ex) {
                const errorMsg = `Failed to translate ${companyId} to ${lang}: ${ex}`;
                errors.push(errorMsg);
                consola.error(errorMsg);
            }
        }
    }

    return result;
}

async function translateCompanyDescriptions(translations: Translations, companies: Companies) {
    const syncedTranslations = translations;
    let translatedCompaniesCount = 0;
    let translationsCount = 0;
    let previousTranslationsCount = 0;
    const errors: string[] = [];

    consola.info('Start translating company descriptions');

    const companyIds = Object.keys(companies);
    const totalCompanies = companyIds.length;
    let processedCount = 0;

    for (const companyId of companyIds) {
        processedCount += 1;
        const company = companies[companyId];
        const sourceDescription = company.description;
        let companyTranslations: TranslationResult = syncedTranslations[companyId] ?? {};
        const sourceChanged = companyTranslations.sourceHash !== hashDescription(sourceDescription);

        if (!isDescriptionNeedToTranslate(sourceDescription)) {
            consola.info(
                `[${processedCount}/${totalCompanies}] ${companyId}: skipping (empty or numeric)`,
            );
            companyTranslations = copySourceToAllLang(companyTranslations, sourceDescription);
        } else {
            const missingLangs = languages.filter(
                (lang) => companyTranslations[lang] === undefined,
            );
            if (!sourceChanged && missingLangs.length === 0) {
                consola.info(
                    `[${processedCount}/${totalCompanies}] ${companyId}: all translations up to date`,
                );
            } else {
                const count = sourceChanged ? languages.length : missingLangs.length;
                consola.info(
                    `[${processedCount}/${totalCompanies}] ${companyId}:`
                    + ` translating to ${count} languages...`,
                );
            }

            companyTranslations = await generateTranslations(
                companyTranslations,
                sourceChanged,
                companyId,
                company.name,
                sourceDescription,
                errors,
            );
            translationsCount += Object.keys(companyTranslations).length;
        }

        if (translationsCount !== previousTranslationsCount) {
            translatedCompaniesCount += 1;
            previousTranslationsCount = translationsCount;
        }

        syncedTranslations[companyId] = companyTranslations;

        if (translatedCompaniesCount > 0 && translatedCompaniesCount % 10 === 0) {
            consola.info(
                `Made ${translationsCount} translations in ${translatedCompaniesCount} companies,`
                + ` saving to ${translationsFilePath}`,
            );
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

    let translations: Translations;

    if (!fs.existsSync(translationsFilePath)) {
        consola.info(`Prepare the initial i18n file at ${translationsFilePath}`);
        translations = {};
        fs.writeFileSync(translationsFilePath, JSON.stringify(translations, null, 4));
    } else {
        consola.info(`Reading existing i18n file at ${translationsFilePath}`);
        const rawTranslations = fs.readFileSync(translationsFilePath, 'utf-8');
        translations = JSON.parse(rawTranslations);
    }

    consola.info(`Found ${Object.keys(translations).length} companies in ${translationsFilePath}`);

    const syncErrors = await syncTranslations(translations, companies);

    fs.writeFileSync(translationsFilePath, JSON.stringify(translations, null, 4));
    consola.info(`Translations saved to ${translationsFilePath}`);

    const completenessErrors = validateCompleteness(translations);
    const allErrors = [...syncErrors, ...completenessErrors];

    consola.info('\n=== Translation Summary ===');
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
