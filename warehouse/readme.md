# Installation

From this folder, simply type...

npm install

n.b. Requires node.js and npm to be installed



# API

## Get resource value

/<endpoint>/<resource uri>/											GET

return example: {"status":"OK","value":"23","age":5718}

## Set resource value

/<enpoint>/<resource uri>/											PUT

## Get resource history

/history/<enpoint>/<resource uri>/?parameter=value					GET

### Parameter values

limit					(integer)				limits the number of items returned
sort					(asc,1,desc,-1)			orders the items in reference to _id
starttimestamp			(timestamp)				timestamp to start select
endtimestamp			(timestamp)				timestamp to stop select
days					(integer)				number of days to select depending on set startday and endday
startday				(integer)				number of days ago to start select
endday					(integer)				number of days ago to end select

return example: [{"endpoint":"a0c50f17-62a8-4dcc-8e7b-bb147cb53b50","resource":"/Test/0/P","value":"23","timestamp":1454081050888,"_id":2519}]