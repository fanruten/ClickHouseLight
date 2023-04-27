# ClickhouseLight README

Simple client for ClickHouse DB (http://clickhouse.tech/)

## Features

Let run a request to ClickHouse DB.
The server name must be written in file `### server=<clickhouse_server>`

If the user and the password settings are ommited, then use defaults (`username=='', password=='''`)

```
### server=ch814307.clickhouse.yy.com
### user=default
### password=
### database=

# simple request
# return number of crashes
SELECT
    count(*),
    uniq(user_id)
FROM dev_null
WHERE (dt == today() ) AND (key == 'crash') AND (value == 1)
LIMIT 100
```

Support comments starting from #.

You can save credentials in the `.clickhouse_settings` file, which should be placed in the root of a workspace.
```
{
    "credentials": [
        {
            "alias": "prod",
            "server": "clickhouse.production.svc.cluster.local",
            "port": 8123,
            "user": "admin",
            "password": "Hell@0123"
        }
    ]
}
```

And after use them from your requests

```
### alias=prod

# simple request
# return number of crashes
SELECT
    count(*),
    uniq(user_id)
FROM dev_null
WHERE (dt == today() ) AND (key == 'crash') AND (value == 1)
LIMIT 100
```

### 0.0.6

* Support aliases to the .clickhouse_settings file

### 0.0.4

* Support a connection with a random http port
* Support store settings in the .clickhouse_settings file

### 0.0.3

* By default `user` is unset

### 0.0.2

* Support database selection through `### database=default`.
* Fix show error lines.
* Changle loader style.

### 0.0.1

Initial release.
