# Companies DB

This is a companies DB that we use in AdGuard Home and AdGuard DNS.
It is basically the [Whotracks.me](https://github.com/whotracksme/whotracks.me)
database converted to a simple JSON format with some additions from us.

In addition, there's also a file with companies metadata that we use in
AdGuard VPN.

### Contribute

If you want to contribute to this data, please open a pull request.

Here are the files that you can change.

**Trackers database**

- `dist/adguard.json` - trackers data. The data from this file will override
  data selected from `Whotracks.me` database in case if there's any
  intersection.
- `dist/adguard_companies.json` - companies data. The data from this file will
  override data selected from `Whotracks.me` database in case if there's any
  intersection.
- `dist/vpn_services.json` - contains a list of "Services" that can be added
  to exclusions in AdGuard VPN apps. This file is composed manually and not
  built from other sources.

### How to build trackers data

```sh
# Download Whotracks.me data
aws --no-sign-request s3 cp s3://data.whotracks.me/trackerdb.sql .
# Run the script
yarn install
yarn convert
```

#### Sources

- `dist/adguard.json`
- `dist/adguard_companies.json`

#### Output

- `dist/adguard.json` - trackers data json file. We don't merge it with
  `whotracksme.json`.
- `dist/whotrackme.json` - trackers data json file.
- `dist/companies.json` - companies data json file. This file contains companies
  list merged with AdGuard companies from `adguard_companies.json`.
