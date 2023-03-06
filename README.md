# Companies DB

This is a companies DB that we use in AdGuard Home and AdGuard DNS.
It is basically the [Whotracks.me](https://github.com/whotracksme/whotracks.me)
database converted to a simple JSON format with some additions from us.

In addition, there's also a file with companies metadata that we use in
AdGuard VPN.

## Workflow

- create a fork of the repository on GitHub.
- create a branch from actual main branch.
- add a tracker.
- create a Pull Request.

To work with the repository you need:

- [Python](https://www.python.org/downloads/) 3.6 or newer.
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).

## Naming of branches and commits

- the branch name format:
    `fix/issueNumber_domain`

```markdown
fix/34_showrss.info
```

- the commit message format:
    `Fix #issueNumber domain`

```markdown
Fix #34 showrss.info
```

## Assignment of files

The list of trackers and companies is generated from the database [whotracks.me](http://whotracks.me).

**Trackers**:

- [dist/whotracksme.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/whotracksme.json) - contains information about trackers, fetched from whotracks.me.
- [source/trackers.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/trackers.json) - contains information about trackers, which overwrites or supplements [dist/whotracksme.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/whotracksme.json).

**Companies**:

- [dist/companies.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/companies.json) - contains information about companies, obtained by merging the [whotracks.me](http://whotracks.me) database with [source/companies.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/source/companies.json).
- [source/companies.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/source/companies.json) - contains information about companies, which overwrites or supplements information in [companies.json](https://github.com/AdguardTeam/companiesdb/blob/main/dist/companies.json) .

**VPN Services**:

- [source/vpn_services.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/vpn_services.json) - contains a list of "Services" that can be added to exclusions in AdGuard VPN apps. This file is composed manually and not
  built from other sources.
- [dist/vpn_services.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/vpn_services.json) - just a copy of [source/vpn_services.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/vpn_services.json).

## How to add new or rewrite whotracks.me data

If you need to add new data or to rewrite [whotracks.me](http://whotracks.me/) data:

- **company** - add to [source/companies.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/source/companies.json)
- **tracker** - add in [source/trackers.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/trackers.json)

> **Warning**
>
> Add companies and tracker names in alphabetical order. Add tracker domains alphabetically **by value.**

### How to add a new company or overwrite whotracks.me data

The data about the company is added to the [source/companies.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/source/companies.json) file into the JSON key with the name that defines **companyId**, which is used when adding trackers:

- **name** - the official name of the company, will be displayed in the filter log.
- **websiteUrl** [](https://www.notion.so/companiesdb-87733d1e43294ceb9311e6e60c1663b4) - the address of the company website, also used to define the company icon.
- **description** - company description, not displayed anywhere.

```json
"companyincID": {
    "name": "Company inc.",
    "websiteUrl": "https://www.company.org/",
    "description": "Description of Company inc."
}
```

### How to add a new tracker or overwrite whotracks.me data

The data about the tracker is added to the [source/trackers.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/trackers.json) file into the nested JSON key inside the **trackers** section with the name that defines the **tracker name** of the company, which is used when adding trackers to the **trackerDomains** section:

- **name** - tracker name of the company.
- **categoryId** - tracker category.
- **url** - the address of the company tracker.
- **companyId** - company ID, taken from [dist/companies.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/companies.json) or [source/companies.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/source/companies.json)

```json
"trackers": {
        "company_trackername": {
            "name": "Company inc. Analytics",
            "categoryId": 6,
            "url": "https://analytics.company.org/",
            "companyId": "companyincID"
        }
}
```

Add tracker domains to the **trackerDomains** section:

- **key** - tracker domain.
- **value** - the **tracker name** of the company.

```json
"trackerDomains": {
        "collect.company.org": "company_trackername"
}
```

> **Warning**
>
> If **the value does not exist** - enter **null**:

```json
"url": null
```

## Tracker categories

| # | Name | Purpose |
| --- | --- | --- |
| 0 | audio_video_player | Enables websites to publish, distribute, and optimize video and audio content |
| 1 | comments | Enables comments sections for articles and product reviews |
| 2 | customer_interaction | Includes chat, email messaging, customer support, and other interaction tools |
| 3 | pornvertising | Delivers advertisements that generally appear on sites with adult content |
| 4 | advertising | Provides advertising or advertising-related services such as data collection, behavioral analysis or re-targeting |
| 5 | essential | Includes tag managers, privacy notices, and technologies that are critical to the functionality of a website |
| 6 | site_analytics | Collects and analyzes data related to site usage and performance |
| 7 | social_media | Integrates features related to social media sites |
| 8 | misc | This tracker does not fit in other categories |
| 9 | cdn | Content delivery network that delivers resources for different site utilities and usually for many different customers |
| 10 | hosting | This is a service used by the content provider or site owner |
| 11 | unknown | This tracker has either not been labelled yet, or we do not have enough information to label it |
| 12 | extensions | - |
| 13 | email | Includes webmail and email clients |
| 14 | consent | - |
| 15 | telemetry | - |
| 16 | mobile_analytics | Collects and analyzes data related to mobile app usage and performance |

## **How to build trackers data**

```bash
# Download Whotracks.me data
aws --no-sign-request s3 cp s3://data.whotracks.me/trackerdb.sql .
# Run the script
yarn install
yarn convert
```

The result is:

- **dist/companies.json** - companies data JSON file. This file contains companies
list from whotracks.me merged with AdGuard companies from
**source/companies.json**.
- **dist/trackers.json** - trackers data json file. Combined data from two files:
**source/trackers.json** and **dist/whotracksme.json**.
    To the information, added from AdGuard files, is added an additional key
    **"source": "AdGuard"**

- **dist/whotrackme.json** - actual **whotrack.me** trackers data json file, compiled from **trackerdb.sql**.

During the build process, a list of warnings and errors is displayed that should be fixed.

## Company icons

The favicon of the company website is used as the company icon. It can be checked using our icon service:

[https://icons.adguard.org/icon?domain=adguard.com](https://icons.adguard.org/icon?domain=adguard.com)
