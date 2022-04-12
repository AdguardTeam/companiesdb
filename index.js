const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const consola = require('consola');

// Needs to be downloaded prior to running the script:
// aws --no-sign-request s3 cp s3://data.whotracks.me/trackerdb.sql .
const INPUT_SQL_PATH = 'trackerdb.sql';
const OUTPUT_PATH = 'dist/whotracksme.json';

async function runScript() {
    consola.info(`Reading ${INPUT_SQL_PATH}`);
    const trackersDbSql = fs.readFileSync(INPUT_SQL_PATH).toString();

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
        companies: {},
        trackers: {},
        trackerDomains: {},
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

            whotracksme.companies[row.id] = {
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

        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(whotracksme, 0, 4));
        consola.info(`Trackers json file has been updated: ${OUTPUT_PATH}`);
    });
}

runScript();
