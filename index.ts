import * as fs from 'fs';
import * as zod from 'zod';
import { consola } from 'consola';
import { stringify } from 'csv-stringify/sync';

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
 * Schema parser for the companies JSON file.
 */
const companiesJSONSchema = zod.object({
    timeUpdated: zod.string(),
    companies: zod.record(
        zod.object({
            name: zod.string(),
            // FIXME: Does the string value always have to be a full URL?
            // FIXME: Can value be null?
            websiteUrl: zod.string().or(zod.null()),
            // FIXME: Can value be null?
            description: zod.string().or(zod.null()),
            source: zod.string().optional(),
        }).strict(),
    ),
}).strict();

/**
 * Schema type of the companies JSON file.
 */
type CompaniesJSON = zod.infer<typeof companiesJSONSchema>;

/**
 * Schema parser for the trackers JSON file.
 */
const trackersJSONSchema = zod.object({
    timeUpdated: zod.string(),
    categories: zod.record(zod.string()),
    trackers: zod.record(
        zod.object({
            name: zod.string(),
            categoryId: zod.number().optional(),
            // FIXME: Can value be null?
            url: zod.string().or(zod.null()),
            companyId: zod.string().or(zod.null()),
            source: zod.string().optional(),
        }).strict(),
    ),
    trackerDomains: zod.record(zod.string()),
}).strict();

/**
 * Schema type of the trackers JSON file.
 */
type TrackersJSON = zod.infer<typeof trackersJSONSchema>;

/**
 * Schema parser for the VPN services JSON file.
 */
const vpnServiceSchema = zod.object({
    service_id: zod.string(),
    service_name: zod.string(),
    categories: zod.array(zod.string()),
    domains: zod.array(zod.string()),
    icon_domain: zod.string(),
    modified_time: zod.string(),
});

const VpnServicesJSONSchema = vpnServiceSchema.array();

/**
 * Schema type of the service vpn object and vpn services JSON file.
 */
type VpnService = zod.infer<typeof vpnServiceSchema>;
type VpnServicesJSON = zod.infer<typeof VpnServicesJSONSchema>;

/**
 * Reads and parse JSON file from source.
 *
 * @param source Source file path.
 * @returns JSON data.
 * @throws an error if the JSON file is invalid or does not exist.
 */
function readJSON(source: string): unknown {
    consola.info(`Reading ${source} file`);
    return JSON.parse(fs.readFileSync(source, 'utf8'));
}

/**
 * Writes JSON file to destination.
 *
 * @param destination Destination file path.
 * @param data JSON data to write.
 * @throws an error if the JSON file is invalid or destination does not exist.
 */
function writeJSON<T>(destination: string, data: T): void {
    consola.info(`Writing ${destination} file`);
    return fs.writeFileSync(destination, `${JSON.stringify(data, null, 4)}\n`);
}

/**
 * Reads and parse the companies JSON.
 *
 * @param source Source JSON path.
 * @returns parsed companies JSON data.
 */
function readCompaniesJSON(source: string): CompaniesJSON {
    const data = readJSON(source);

    return companiesJSONSchema.parse(data);
}

/**
 * Reads and parse the trackers JSON.
 *
 * @param source Source JSON path.
 * @returns parsed trackers JSON data.
 */
function readTrackersJSON(source: string): TrackersJSON {
    const data = readJSON(source);

    return trackersJSONSchema.parse(data);
}

/**
 * Reads and parse the vpn services JSON.
 *
 * @param source Source JSON path.
 * @returns parsed services JSON data.
 */
function readVpnJSON(source: string): VpnServicesJSON {
    const data = readJSON(source);

    return VpnServicesJSONSchema.parse(data);
}

/**
 * Sorts the records alphabetically by key or value.
 *
 * @param record The record to sort.
 * @param sortByKey Flag specifying whether to sort by key or value. Defaults sort by key (true).
 * @returns New sorted record.
 */
function sortRecordsAlphabetically<T>(
    record: Record<string, T>,
    sortByKey = true,
): Record<string, T> {
    return Object.fromEntries(Object.entries(record).sort(([aKey, aValue], [bKey, bValue]) => {
        const a = sortByKey ? aKey : aValue;
        const b = sortByKey ? bKey : bValue;

        if (a < b) {
            return -1;
        }

        if (a > b) {
            return 1;
        }

        return 0;
    }));
}

type Companies = CompaniesJSON['companies'];

/**
 * Creates new companies data by merging whotracksme companies data with AdGuard companies data.
 * Adguard data marked as source: 'AdGuard'.
 *
 * @param whotrackmeCompanies Whotracksme companies data.
 * @param adguardCompanies AdGuard companies data.
 * @returns merged companies data.
 */
function buildCompanies(
    whotrackmeCompanies: Companies,
    adguardCompanies: Companies,
): Companies {
    // clone the whotracksme companies data
    const merged = { ...whotrackmeCompanies };

    Object.entries(adguardCompanies).forEach(([id, company]) => {
        // Overriding whotracksme info with the companies defined in the source
        // companies file.
        // Also, indicate, that the company came from AdGuard data.
        merged[id] = company;
        merged[id].source = 'AdGuard';
    });

    return sortRecordsAlphabetically(merged);
}

type TrackersCategories = TrackersJSON['categories'];

/**
 * Creates new categories data by merging whotracksme companies data with AdGuard companies data.
 *
 * @param whotracksmeTrackersCategories
 * @param adguardTrackersCategories
 * @returns merged categories data.
 */
function buildTrackersCategories(
    whotracksmeTrackersCategories: TrackersCategories,
    adguardTrackersCategories: TrackersCategories,
): TrackersCategories {
    return sortRecordsAlphabetically({
        ...whotracksmeTrackersCategories,
        ...adguardTrackersCategories,
    });
}

type Trackers = TrackersJSON['trackers'];

/**
 * Creates new trackers data by merging whotracksme trackers data with AdGuard trackers data.
 * Also validates the company reference for each tracker.
 *
 * @param whotracksmeTrackers Whotracksme trackers data.
 * @param adguardTrackers AdGuard trackers data.
 * @param companies Merged companies data.
 * @returns merged trackers data.
 * @throws an error if at least one company reference is invalid.
 */
function buildTrackers(
    whotracksmeTrackers: Trackers,
    adguardTrackers: Trackers,
    companies: Companies,
): Trackers {
    const merged = { ...whotracksmeTrackers };

    Object.entries(adguardTrackers).forEach(([id, tracker]) => {
        // Overriding whotracksme info with the companies defined in the source
        // companies file.
        // Also, indicate, that the company came from AdGuard data.
        merged[id] = tracker;
        merged[id].source = 'AdGuard';
    });

    // Validate the company reference and exit immediately if it's wrong.
    Object.entries(merged).forEach(([id, tracker]) => {
        if (tracker.companyId === null) {
            consola.warn(`Tracker ${id} has no company ID, consider adding it`);
        } else if (!companies[tracker.companyId]) {
            throw new Error(`Tracker ${id} has an invalid company ID: ${tracker.companyId}`);
        }
    });

    return sortRecordsAlphabetically(merged);
}

type TrackersDomains = TrackersJSON['trackerDomains'];

/**
 * Creates new tracker domains data by merging whotracksme trackers
 * domains data with AdGuard trackers domains data.
 * Also validates the tracker reference for each tracker domain.
 *
 * @param whotracksmeTrackersDomains Whotracksme trackers domains data.
 * @param adguardTrackersDomains AdGuard trackers domains data.
 * @param trackers Merged trackers data.
 * @returns merged tracker domains data.
 * @throws an error if at least one tracker reference is invalid.
 */
function buildTrackersDomains(
    whotracksmeTrackersDomains: TrackersDomains,
    adguardTrackersDomains: TrackersDomains,
    trackers: Trackers,
): TrackersDomains {
    const merged = { ...whotracksmeTrackersDomains, ...adguardTrackersDomains };

    // Validate the tracker domains and exit immediately if it's wrong.
    Object.entries(merged).forEach(([domain, trackerId]) => {
        // Make sure that the tracker ID is valid.
        if (!trackers[trackerId]) {
            throw new Error(`Tracker domain ${domain} has an invalid tracker ID: ${trackerId}`);
        }
    });

    return sortRecordsAlphabetically(merged, false);
}
/**
 * Formats the current date and time in the format 'YYYY-MM-DD HH:MM'.
 * @returns The current date and time in the format 'YYYY-MM-DD HH:MM'.
 */
function getCurrentDateTime(): string {
    const now = new Date();

    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Updates the modified_time field in the vpn services JSON file.
 * If a service is not present in the upToDateMap, it will be added with the current date.
 * If a service is present in the upToDateMap, it will be updated with the current date if
 * any of its fields have changed.
 * @param vpnInput The new vpn services JSON file.
 * @param vpnOutput The up to date vpn services JSON file.
 * @returns The updated vpn services JSON file.
*/

function updateVpnServicesJSONDate(
    vpnInput: VpnServicesJSON,
    vpnOutput: VpnServicesJSON,
): VpnServicesJSON {
    const timeUpdated = getCurrentDateTime();

    // Create maps of services based on their id
    const upToDateMap: { [key: string]: VpnService } = vpnOutput.reduce((map, obj) => ({
        ...map,
        [obj.service_id]: obj,
    }), {});

    const updatedMap: { [key: string]: VpnService } = vpnInput.reduce((map, obj) => ({
        ...map,
        [obj.service_id]: obj,
    }), {});

    // Iterate over keys in updatedMap
    Object.keys(updatedMap).forEach((key) => {
        // Check if the key exists in upToDateMap
        if (!upToDateMap[key]) {
            consola.info(updatedMap[key]);
            updatedMap[key].modified_time = timeUpdated;
        } else {
            // Check values
            Object.keys(updatedMap[key]).forEach((k) => {
                let shouldUpdateDate = false;
                // if the value is a string, compare the strings
                if (typeof updatedMap[key][k as keyof VpnService] === 'string') {
                    shouldUpdateDate = updatedMap[key][k as keyof VpnService]
                     !== upToDateMap[key][k as keyof VpnService];
                }
                // if the value is an array, compare the arrays
                if (Array.isArray(updatedMap[key][k as keyof VpnService])) {
                    const updatedArray = updatedMap[key][k as keyof VpnService] as any[];
                    const upToDateArray = upToDateMap[key][k as keyof VpnService] as any[];
                    shouldUpdateDate = !updatedArray.every(
                        (element, index) => element === upToDateArray[index],
                    );
                }
                if (shouldUpdateDate) {
                    updatedMap[key].modified_time = timeUpdated;
                }
            });
        }
    });

    return Object.values(updatedMap);
}

/**
 * Builds the trackers CSV file in the following form:
 * domain;tracker_id;category_id
 *
 * This CSV file is used in the ETL process of AdGuard DNS (for data enrichment),
 * any changes to its format should be reflected in the ETL code as well.
 *
 * @param trackers Merge trackers data.
 * @param trackersDomains Merged tracker domains data.
 * @returns CSV file content.
 * @throws an error if at least one tracker reference is invalid.
 */
function buildTrackersCSV(
    trackers: Trackers,
    trackersDomains: TrackersDomains,
): string {
    // Init with the header.
    let csv = 'domain;tracker_id;category_id\n';

    Object.entries(trackersDomains).forEach(([domain, trackerId]) => {
        const tracker = trackers[trackerId];
        if (!tracker) {
            throw new Error(`Tracker domain ${domain} has an invalid tracker ID: ${trackerId}`);
        }
        const { categoryId } = tracker;
        if (typeof categoryId !== 'undefined') {
            const csvRow = stringify([[domain, trackerId, categoryId]], {
                delimiter: ';',
                quoted_match: ',',
            });
            csv += csvRow;
        } else {
            consola.warn(`Tracker ${trackerId} has no category ID, consider adding it`);
        }
    });

    return csv;
}

try {
    consola.info('Start building the companies DB');

    const timeUpdated = new Date().toISOString();

    const whotrackmeTrackersJSON = readTrackersJSON(WHOTRACKSME_INPUT_PATH);
    const adguardTrackersJSON = readTrackersJSON(TRACKERS_INPUT_PATH);
    const whotrackmeCompaniesJSON = readCompaniesJSON(WHOTRACKSME_COMPANIES_INPUT_PATH);
    const adguardCompaniesJSON = readCompaniesJSON(COMPANIES_INPUT_PATH);

    writeJSON<TrackersJSON>(WHOTRACKSME_OUTPUT_PATH, {
        ...whotrackmeTrackersJSON,
        timeUpdated,
    });

    consola.info(`Building ${COMPANIES_OUTPUT_PATH} file`);

    const companies = buildCompanies(
        whotrackmeCompaniesJSON.companies,
        adguardCompaniesJSON.companies,
    );

    writeJSON<CompaniesJSON>(COMPANIES_OUTPUT_PATH, {
        timeUpdated,
        companies,
    });

    consola.info(`Building ${TRACKERS_OUTPUT_PATH} file`);

    const categories = buildTrackersCategories(
        whotrackmeTrackersJSON.categories,
        adguardTrackersJSON.categories,
    );

    const trackers = buildTrackers(
        whotrackmeTrackersJSON.trackers,
        adguardTrackersJSON.trackers,
        companies,
    );

    const trackerDomains = buildTrackersDomains(
        whotrackmeTrackersJSON.trackerDomains,
        adguardTrackersJSON.trackerDomains,
        trackers,
    );

    writeJSON<TrackersJSON>(TRACKERS_OUTPUT_PATH, {
        timeUpdated,
        categories,
        trackers,
        trackerDomains,
    });

    consola.info(`Building ${TRACKERS_CSV_OUTPUT_PATH} file`);

    const csv = buildTrackersCSV(trackers, trackerDomains);

    fs.writeFileSync(TRACKERS_CSV_OUTPUT_PATH, csv);

    const upToDateVpnServicesJSON = readVpnJSON(VPN_SERVICES_OUTPUT_PATH);

    const vpnServicesJSON = readVpnJSON(VPN_SERVICES_INPUT_PATH);

    const updatedVpnServicesJSON = updateVpnServicesJSONDate(
        vpnServicesJSON,
        upToDateVpnServicesJSON,
    );

    writeJSON<VpnServicesJSON>(VPN_SERVICES_OUTPUT_PATH, updatedVpnServicesJSON);

    consola.info('Finished building the companies DB');
} catch (ex) {
    consola.error(`Error while building the companies DB: ${ex}`);
    process.exit(1);
}
