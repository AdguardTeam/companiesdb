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
