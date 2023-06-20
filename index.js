/* eslint-disable no-restricted-syntax */
const fs = require('fs');
const consola = require('consola');

const WHOTRACKSME_INPUT_PATH = 'source/whotracksme.json';
const WHOTRACKSME_COMPANIES_INPUT_PATH = 'source/whotracksme_companies.json';
const COMPANIES_INPUT_PATH = 'source/companies.json';
const TRACKERS_INPUT_PATH = 'source/trackers.json';
const VPN_SERVICES_INPUT_PATH = 'source/vpn_services.json';

const WHOTRACKSME_OUTPUT_PATH = 'dist/whotracksme.json';
const COMPANIES_OUTPUT_PATH = 'dist/companies.json';
const TRACKERS_OUTPUT_PATH = 'dist/trackers.json';
const TRACKERS_CSV_OUTPUT_PATH = 'dist/trackers.csv';
const VPN_SERVICES_OUTPUT_PATH = 'dist/vpn_services.json';

/**
 * Parses whotracksme trackers and companies data from source and writes trackers to dist.
 */
function buildWhotracksme() {
    consola.info('Start building the whotrackme JSON file');

    const whotracksme = JSON.parse(fs.readFileSync(WHOTRACKSME_INPUT_PATH).toString());

    const { companies: whotracksmeCompanies } = JSON.parse(
        fs.readFileSync(WHOTRACKSME_COMPANIES_INPUT_PATH).toString(),
    );

    fs.writeFileSync(WHOTRACKSME_OUTPUT_PATH, `${JSON.stringify(whotracksme, 0, 4)}\n`);

    consola.info(`Finished building the whotrackme JSON file: ${WHOTRACKSME_OUTPUT_PATH}`);

    return {
        whotracksme,
        whotracksmeCompanies,
    };
}

/**
 * Builds the companies JSON file.
 */
function buildCompanies(whotracksmeCompanies) {
    consola.info('Start building the companies JSON file');

    const companiesData = {
        timeUpdated: new Date().toISOString(),
        companies: {},
    };

    consola.info(`Reading ${COMPANIES_INPUT_PATH}`);
    const companies = JSON.parse(fs.readFileSync(COMPANIES_INPUT_PATH).toString());

    // Copy whotrackme companies and merge with AdGuard companies.
    companiesData.companies = whotracksmeCompanies;

    for (const [id, company] of Object.entries(companies.companies)) {
        // Overriding whotracksme info with the companies defined in the source
        // companies file.
        // Also, indicate, that the company came from AdGuard data.
        company.source = 'AdGuard';
        companiesData.companies[id] = company;
    }

    fs.writeFileSync(COMPANIES_OUTPUT_PATH, `${JSON.stringify(companiesData, 0, 4)}\n`);
    consola.info(`Finished building the companies JSON file: ${COMPANIES_OUTPUT_PATH}`);

    return companiesData;
}

/**
 * Merges whotracksme trackers database with the AdGuard trackers database.
 *
 * @param {Object} whotracksmeTrackers whotracksme trackers database.
 * @param {Object} companies the map with companies (merged whotracksme+adguard).
 * @returns {Object} the merged trackers database.
 */
function buildTrackers(whotracksmeTrackers, companies) {
    consola.info('Start building the trackers JSON file');

    const trackersData = {
        timeUpdated: new Date().toISOString(),
        categories: {},
        trackers: {},
        trackerDomains: {},
    };

    const trackers = JSON.parse(fs.readFileSync(TRACKERS_INPUT_PATH).toString());

    // First, we merge the categories from both AdGuard and WhoTracksMe.
    trackersData.categories = whotracksmeTrackers.categories;
    for (const [id, category] of Object.entries(trackers.categories)) {
        trackersData.categories[id] = category;
    }

    // Second, we merge the trackers data and override the data from WhoTracksMe.
    trackersData.trackers = whotracksmeTrackers.trackers;
    for (const [id, tracker] of Object.entries(trackers.trackers)) {
        // Indicate, that the tracker data came from AdGuard.
        tracker.source = 'AdGuard';

        // Override the tracker data in the final database.
        trackersData.trackers[id] = tracker;
    }

    // Validate the company information and exit immediately if it's wrong.
    for (const [id, tracker] of Object.entries(trackersData.trackers)) {
        if (tracker.companyId === null) {
            consola.warn(`Tracker ${id} has no company ID, consider adding it`);
        } else if (!companies[tracker.companyId]) {
            throw new Error(`Tracker ${id} has an invalid company ID: ${tracker.companyId}`);
        }
    }

    // Third, merge the "tracker domains" data.
    trackersData.trackerDomains = whotracksmeTrackers.trackerDomains;
    for (const [domain, trackerId] of Object.entries(trackers.trackerDomains)) {
        trackersData.trackerDomains[domain] = trackerId;
    }

    // Validate the tracker domains and exit immediately if it's wrong.
    for (const [domain, trackerId] of Object.entries(trackersData.trackerDomains)) {
        // Make sure that the tracker ID is valid.
        if (!trackersData.trackers[trackerId]) {
            throw new Error(`Tracker domain ${domain} has an invalid tracker ID: ${trackerId}`);
        }
    }

    fs.writeFileSync(TRACKERS_OUTPUT_PATH, `${JSON.stringify(trackersData, 0, 4)}\n`);
    consola.info(`Finished building the trackers JSON file: ${TRACKERS_OUTPUT_PATH}`);

    return trackersData;
}

/**
 * Builds the trackers CSV file in the following form:
 * domain;tracker_id;category_id
 *
 * This CSV file is used in the ETL process of AdGuard DNS (for data enrichment),
 * any changes to its format should be reflected in the ETL code as well.
 *
 * @param {Object} trackersData the trackers database to build the CSV file from.
 */
function buildTrackersCSV(trackersData) {
    consola.info(`Start building the trackers CSV file: ${TRACKERS_CSV_OUTPUT_PATH}`);

    // Init with the header.
    let csv = 'domain;tracker_id;category_id\n';

    for (const [domain, trackerId] of Object.entries(trackersData.trackerDomains)) {
        const tracker = trackersData.trackers[trackerId];

        if (!tracker) {
            throw new Error(`Tracker domain ${domain} has an invalid tracker ID: ${trackerId}`);
        }

        const { categoryId } = tracker;
        if (typeof categoryId !== 'undefined') {
            csv += `${domain};${trackerId};${categoryId}\n`;
        } else {
            consola.warn(`Tracker ${trackerId} has no category ID, consider adding it`);
        }
    }

    fs.writeFileSync(TRACKERS_CSV_OUTPUT_PATH, csv);
    consola.info(`Finished building the trackers CSV file: ${TRACKERS_CSV_OUTPUT_PATH}`);
}

/**
 * Builds the VPN services JSON file.
 * Effectively just copies it from sources.
 */
function buildVpnServices() {
    consola.info('Start building the VPN services JSON file');

    const vpnServices = JSON.parse(fs.readFileSync(VPN_SERVICES_INPUT_PATH).toString());

    fs.writeFileSync(VPN_SERVICES_OUTPUT_PATH, `${JSON.stringify(vpnServices, 0, 4)}\n`);

    consola.info(`Finished building the VPN services JSON file: ${VPN_SERVICES_OUTPUT_PATH}`);
}

(() => {
    try {
        consola.info('Start building the companies DB');

        const whotracksmeDB = buildWhotracksme();
        const companiesData = buildCompanies(whotracksmeDB.whotracksmeCompanies);
        const trackersData = buildTrackers(whotracksmeDB.whotracksme, companiesData.companies);
        buildTrackersCSV(trackersData);
        buildVpnServices();

        consola.info('Finished building the companies DB');
    } catch (ex) {
        consola.error(`Error while building the companies DB: ${ex}`);

        process.exit(1);
    }
})();
