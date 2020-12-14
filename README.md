# ClickhouseLight README

Simple client for ClickHouse DB (http://clickhouse.tech/)

## Features

Let run a request to ClickHouse DB.
Server name must be written in file '### server=<clickhouse_server>'
If user and password ommited, then used defaults ('default':'')

```
### server=ch814307.clickhouse.yy.com
### user=default
### password=

# simple request
# return number of crashes
SELECT
    count(*),
    uniq(user_id)
FROM dev_null
WHERE (dt == today() ) AND (key == 'crash') AND (value == 1)
LIMIT 100
```

## Known Issues

Connects only on 443 port.

## Release Notes

Basic version.
Support comments starting from #.

### 0.0.1

Initial release.
