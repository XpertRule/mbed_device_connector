# Installation

From this folder, simply type...

npm install

n.b. Requires node.js and npm to be installed

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