# Installation

From this folder, simply type...

npm install

n.b. Requires node.js and npm to be installed

# Setup

Edit the settings.json file. The default file looks like this...
```sh
{
    "url": "iot.xpertrule.com",
    "ds_port": 1234,
    "ds_url": "api.connector.mbed.com",
    "ds_auth": "Your ARM mbed device connector auth key goes here",
    "poll_time": 30,
    "xr_port": 5678
}
```
## Setting Values
**url**: The publicly accessable url (or ip address) for the server containing the XpertRule warehouse

**ds_port**: The publicly accessable port used to listed for mbed Device Server responses

**ds_url**: The url for the mbed Device Server (in this example, we will use the hosted mbed Device Connector portal)

**ds_auth**: Your mbed Device Server authorization key. You can retrieve this from your [mbed Devide Connector](https://connector.mbed.com/#home) account

**poll_time**: The number of SECONDS between polling for endpoint/resource values

**xr_port**: The port to listed for XpertRule Warehouse API requests. This is used in the XpertRule Web Author for IoT integration

# API

### Get resources (GET)

Url call:
```sh
/resources/
```

Return example:
```sh
[{"name":"ResourceLED","uri":"a0c50f17-62a8-4dcc-8e7b-bb147cb53b50/Test/0/LED"}]
```

### Get resource value (GET)

Url call:
```sh
/<endpoint>/<resource uri>/
```

Return example:
```sh
{"status":"OK","value":"23","age":5718}
```

### Set resource value (PUT)

Url call:
```sh
/<enpoint>/<resource uri>/
```

### Get resource history (GET)

Url call:
```sh
/history/<enpoint>/<resource uri>/?parameter=value
```

#### Parameter values

 * limit (integer) - limits the number of items returned
 * sort (asc,1,desc,-1) - orders the items in reference to _id
 * starttimestamp (timestamp) - timestamp to start select
 * endtimestamp (timestamp) - timestamp to stop select
 * days (integer) - number of days to select depending on set startday and endday
 * startday (integer) - number of days ago to start select
 * endday (integer) - number of days ago to end select

Return example: 
```sh
[{"endpoint":"a0c50f17-62a8-4dcc-8e7b-bb147cb53b50","resource":"/Test/0/P","value":"23","timestamp":1454081050888,"_id":2519}]
```
