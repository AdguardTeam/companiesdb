# Companies DB

This is a companies DB that we use in AdGuard Home and AdGuard DNS.

It is basically the [Whotracks.me](https://github.com/whotracksme/whotracks.me)
database converted to a simple JSON format with some additions from us.

### How to run

```sh
# Download Whotracks.me data
aws --no-sign-request s3 cp s3://data.whotracks.me/trackerdb.sql .
# Run the script
yarn install
yarn convert
```

### Sources

- `adguard.json` 
    
    Trackers data json file.

- `adguard_companies.json` 
    
    Companies data json file. The data from this file will override data selected from `Whotracks.me` database. 

### Output

- `whotrackme.json`

    Trackers data json file.
    
- `whotrackme_companies.json`

    Companies data json file. This file contains only data selected from `Whotracks.me` database.
    
- `companies.json`

    Companies data json file. This file contains companies list merged with AdGuard companies from `adguard_companies.json`.
