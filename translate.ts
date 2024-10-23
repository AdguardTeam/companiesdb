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

async function translateContent(content: string, langCode: string): Promise<string> {
    const prompt = `Translate the following text to language with code ${langCode}: \n${content}`;

    const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: 'You are a translation assistant.' },
            { role: 'user', content: prompt },
        ],
    });

    return completion.choices[0].message.content!;
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
    newDescription: string,
) : Promise<TranslationResult> {
    const newCompanyTranslations = { ...companyTranslations };
    // If there are no translations for this company, generate them.
    for (const lang of languages) {
        // Only translate it if there's a language missing or if the
        // base description changed.
        if (baseDescriptionChanged || newCompanyTranslations[lang] === undefined) {
            try {
                consola.debug(`Translating ${companyId} description to ${lang}`);
                const translatedText = await translateContent(newDescription, lang);
                newCompanyTranslations[lang] = translatedText;
            } catch (ex) {
                consola.error(`Failed to translate ${companyId} description to ${lang}`, ex);
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

    consola.info('Start translate company descriptions');
    // Sync translations with the companies object.

    for (const companyId in companies) {
        const company = companies[companyId];
        const newDescription = company.description;
        let companyTranslations = syncedTranslations[companyId] ?? {
            [defaultLanguage]: newDescription,
        };
        const baseDescriptionChanged = companyTranslations[defaultLanguage] !== newDescription;

        // Update the base language now.
        companyTranslations[defaultLanguage] = newDescription;
        if (!isDescriptionNeedToTranslate(company.description)) {
            companyTranslations = copyBaseDescriptionToAllLang(
                companyTranslations,
                company.description,
            );
        } else {
            companyTranslations = await generateTranslations(
                companyTranslations,
                baseDescriptionChanged,
                companyId,
                newDescription,
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
}

async function syncTranslations(translations: Translations, companies: Companies) {
    removeObsoleteCompanyDescriptions(translations, companies);
    await translateCompanyDescriptions(translations, companies);
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

    await syncTranslations(translations, companies);
}

main();
