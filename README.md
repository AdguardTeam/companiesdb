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

- [dist/whotracksme.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/whotracksme.json) - just a copy of [source/whotracksme.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/source/whotracksme.json).
- [dist/trackers.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/trackers.json) - contains information about trackers, obtained by merging the [source/trackers.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/source/trackers.json) with [source/whotracksme.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/whotracksme.json).
- [source/whotracksme.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/source/whotracksme.json) - contains information about trackers, fetched from whotracks.me.
- [source/trackers.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/source/trackers.json) - contains information about trackers, which overwrites or supplements [dist/whotracksme.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/whotracksme.json).

**Companies**:

- [dist/companies.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/companies.json) - contains information about companies, obtained by merging the [source/whotracksme_companies.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/source/whotracksme_companies.json) with [source/companies.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/source/companies.json).
- [source/companies.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/source/companies.json) - contains information about companies, which overwrites or supplements information in [source/whotracksme_companies.json](https://github.com/AdguardTeam/companiesdb/blob/main/source/whotracksme_companies.json).
- [source/whotracksme_companies.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/source/whotracksme_companies.json) - contains information about companies, fetched from whotracks.me.

**VPN Services**:

- [source/vpn_services.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/vpn_services.json) - contains a list of "Services" that can be added to exclusions in AdGuard VPN apps. This file is composed manually and not
  built from other sources. New services should be added in alphabetical order.
- [dist/vpn_services.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/vpn_services.json) - just a copy of [source/vpn_services.json](https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/vpn_services.json) with automatically added update time if the service has been added or modified.

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

| #   | Name                 | Purpose                                                                                                                |
| --- | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 0   | audio_video_player   | Enables websites to publish, distribute, and optimize video and audio content                                          |
| 1   | comments             | Enables comments sections for articles and product reviews                                                             |
| 2   | customer_interaction | Includes chat, email messaging, customer support, and other interaction tools                                          |
| 3   | pornvertising        | Delivers advertisements that generally appear on sites with adult content                                              |
| 4   | advertising          | Provides advertising or advertising-related services such as data collection, behavioral analysis or re-targeting      |
| 5   | essential            | Includes tag managers, privacy notices, and technologies that are critical to the functionality of a website           |
| 6   | site_analytics       | Collects and analyzes data related to site usage and performance                                                       |
| 7   | social_media         | Integrates features related to social media sites                                                                      |
| 8   | misc                 | This tracker does not fit in other categories                                                                          |
| 9   | cdn                  | Content delivery network that delivers resources for different site utilities and usually for many different customers |
| 10  | hosting              | This is a service used by the content provider or site owner                                                           |
| 11  | unknown              | This tracker has either not been labelled yet, or we do not have enough information to label it                        |
| 12  | extensions           | -                                                                                                                      |
| 13  | email                | Includes webmail and email clients                                                                                     |
| 14  | consent              | -                                                                                                                      |
| 15  | telemetry            | -                                                                                                                      |
| 16  | mobile_analytics     | Collects and analyzes data related to mobile app usage and performance                                                 |

## **How to build trackers data**

```bash
yarn install
yarn convert
```

The result is:

- **dist/companies.json** - companies data JSON file. This file contains the companies list from whotracks.me merged with AdGuard companies from **source/companies.json**.
- **dist/trackers.json** - trackers data JSON file. Combined data from two files:

  - **source/trackers.json**
  - **dist/whotracksme.json**.

  An additional key is added to the information from AdGuard files:
  **"source": "AdGuard"**

- **dist/trackers.csv** - trackers data CSV file. This file is used by the ETL process of AdGuard DNS, be very careful
  with changing it's structure.

- **dist/whotrackme.json** - actual **whotrack.me** trackers data json file, compiled from **trackerdb.sql**.

During the build process, a list of warnings and errors is displayed that should be fixed.

## Company icons

The favicon of the company website is used as the company icon. It can be checked using our icon service:

[https://icons.adguard.org/icon?domain=adguard.com](https://icons.adguard.org/icon?domain=adguard.com)

## Company description translations

Run the following command to translate company descriptions into different
languages (you need an OpenAI API key for that):
If the description of the companies has not changed, the update will not occur

```bash
OPENAI_API_KEY="YOUR_API_KEY" yarn translate
```

You can modify the list of supported languages in [./translate.ts].

## Policy

The detailed policy currently is under development. The decision to add a company is at the discretion of the maintainers,
each request will review on a case-by-case basis. Factors such as the company's industry, reputation, and relevance
will be taken into account during the evaluation process.

Currently, we are avoiding adding personal websites/blogs or services that do not seem to have sufficient popularity.

## Acknowledgements

We would like to thank the team at **whotrack.me** for their work.
Initially, our database was built on top of the **whotrack.me** database, using their extensive data collection. However, we would like to emphasise that our current database is now independent and updated separately from **whotrack.me**.
