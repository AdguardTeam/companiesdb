const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const consola = require('consola');

// Needs to be downloaded prior to running the script:
// aws --no-sign-request s3 cp s3://data.whotracks.me/trackerdb.sql .
const INPUT_SQL_PATH = 'trackerdb.sql';
const ADG_COMPANIES_INPUT_PATH = 'dist/adguard_companies.json';

const OUTPUT_PATH = 'dist/whotracksme.json';
const WTM_COMPANIES_OUTPUT_PATH = 'dist/whotracksme_companies.json';
const COMPANIES_OUTPUT_PATH = 'dist/companies.json';

async function runScript() {
    consola.info(`Reading ${INPUT_SQL_PATH}`);
    const trackersDbSql = fs.readFileSync(INPUT_SQL_PATH).toString();
    consola.info(`Reading ${ADG_COMPANIES_INPUT_PATH}`);
    const adGuardCompanies = JSON.parse(fs.readFileSync(ADG_COMPANIES_INPUT_PATH).toString());

    const transformToSqlite = (sql) => {
        let sqlFixed = sql.trim();

        if (sqlFixed.indexOf('CREATE TABLE') >= 0) {
            sqlFixed = sqlFixed.replace(/UNIQUE/g, '');
        }

        return sqlFixed;
    };

    const whotracksme = {
        timeUpdated: new Date().toISOString(),
        categories: {},
        trackers: {},
        trackerDomains: {},
    };

    const whotracksmeCompaniesData = {
        timeUpdated: new Date().toISOString(),
        companies: {},
    };

    const companiesData = {
        timeUpdated: new Date().toISOString(),
        companies: {},
    };

    consola.info('Initializing the in-memory trackers database');
    const db = new sqlite3.Database(':memory:');
    db.serialize(() => {
        trackersDbSql.split(/;\s*$/gm).forEach((sql) => {
            const sqlFixed = transformToSqlite(sql);
            db.run(sqlFixed, () => { });
        });

        db.each('SELECT * FROM categories', (err, row) => {
            if (err) {
                consola.error(err);
                return;
            }

            whotracksme.categories[row.id] = row.name;
        });

        const companies = {};
        db.each('SELECT * FROM companies', (err, row) => {
            if (err) {
                consola.error(err);
                return;
            }

            companies[row.id] = {
                id: row.id,
                name: row.name,
                website_url: row.website_url,
            };

            whotracksmeCompaniesData.companies[row.id] = {
                name: row.name,
                websiteUrl: row.website_url,
                description: row.description,
            };
        });

        db.each('SELECT * FROM trackers', (err, row) => {
            if (err) {
                consola.error(err);
                return;
            }

            const company = companies[row.company_id];
            let url = row.website_url;
            if (!url && company) {
                url = company.website_url;
            }

            whotracksme.trackers[row.id] = {
                name: row.name,
                categoryId: row.category_id,
                url,
                companyId: row.company_id,
            };
        });

        db.each('SELECT * FROM tracker_domains', (err, row) => {
            if (err) {
                consola.error(err);
                return;
            }

            whotracksme.trackerDomains[row.domain] = row.tracker;
        });
    });

    db.close((err) => {
        if (err) {
            consola.error(err);
            return;
        }

        // Copy whotrackme companies and merge with adGuard companies
        companiesData.companies = { ...whotracksmeCompaniesData.companies };
        // eslint-disable-next-line no-restricted-syntax
        for (const [id, company] of Object.entries(adGuardCompanies.companies)) {
            companiesData.companies[id] = company;
        }

        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(whotracksme, 0, 4));
        consola.info(`Trackers json file has been updated: ${OUTPUT_PATH}`);

        fs.writeFileSync(WTM_COMPANIES_OUTPUT_PATH, JSON.stringify(whotracksmeCompaniesData, 0, 4));
        consola.info(`Whotracksme companies json file has been updated: ${WTM_COMPANIES_OUTPUT_PATH}`);

        fs.writeFileSync(COMPANIES_OUTPUT_PATH, JSON.stringify(companiesData, 0, 4));
        consola.info(`Companies json file has been updated: ${COMPANIES_OUTPUT_PATH}`);
    });
}

runScript();
