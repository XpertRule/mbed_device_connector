var http = require("http"),
    https = require("https"),
    url = require("url"),
    fs = require("fs"),
    util = require("util"),
    Db = require("tingodb")().Db;

// ===== Settings =====

// default
var settings = {
    url: "iot.xpertrule.com",                // globally accessable DNS for this server

    ds_port: 1234,                           // port to listen on (for api.connector.mbed.com notifications)
    ds_url: "api.connector.mbed.com",        // url for ARM Device Connect Server
    ds_auth: "<your auth token goes here>",  // Auth token for ARM Device Connect Server
    poll_time: 30,                           // Time (in seconds) between polling for current values

    xr_port: 5678                            // port to listen on (for XpertRule api)
};

// read local file and overwrite as appropriate
if (fs.existsSync("./settings.json")) {
    var data = fs.readFileSync("./settings.json", "utf8");
    var newSettings = JSON.parse(data);
    for (var aProp in newSettings) {
        settings[aProp] = newSettings[aProp];
    }
}

console.log("--------");
console.log(GetPrintableTimeStamp() + " XpertRule IoT warehouse for ARM mbed Device Connect Server");
console.log("--------");

// ===== Db ========

var DB_PATH = "";
var COLLECTION_FILE = "warehouse_collection_db";
var db = new Db(DB_PATH, {});

function insertResourceIntoDb(endpoint, resource) {
    var collection = db.collection(COLLECTION_FILE);

    var insertobject = {
        endpoint: endpoint.name,
        resource: resource.uri,
        value: resource.value,
        timestamp: resource.timestamp
    };

    collection.insert(insertobject, {w: 1}, function(err, result) {
        //log
        if (err) {
            console.log("Insert error: " + err);
        }

        //Clean up
        insertobject._id = undefined;
    });
}

function selectResourceFromDB(endpointname, resourcename, starttime, endtime, limit, sort, callback) {
    var collection = db.collection(COLLECTION_FILE);

    var search = {
        endpoint: endpointname,
        resource: resourcename
    };

    var timesearch = {};
    if (starttime) {
        search.timestamp = timesearch;  //add to search
        timesearch.$gt = starttime;
    }
    if (endtime) {
        search.timestamp = timesearch;  //add to search
        timesearch.$lt = endtime;
    }

    console.log("///////////////////////");
    console.log(search);

    collection.find(search).limit(limit).sort(["_id", sort]).toArray(function(err, items) {
        //log
        if (err) {
            console.log("Select error: " + err);
        }

        if (!items) {
            items = [];
        }

        callback(items);
    });
}

// ===== Utils =====
function GetPrintableTimeStamp(timestamp) {
    var d;

    if (!timestamp) {
        d = new Date();
    } else {
        d = new Date(timestamp);
    }
    function pad(n) {
        return n < 10 ? "0" + n : n;
    }
    return d.getUTCFullYear() + "-" +
        pad(d.getUTCMonth() + 1) + "-" +
        pad(d.getUTCDate()) + " " +
        pad(d.getUTCHours()) + ":" +
        pad(d.getUTCMinutes()) + ":" +
        pad(d.getUTCSeconds()) + " ";
}

// -------------------

// HTTP server (for device connect)
var callback_server = http.createServer(function(request, response) {

    // parse the URL (busting up the search params too)
    var params = url.parse(request.url, true);

    // If the request is a silly browser request, just igone it
    if (params.pathname == "/favicon.ico") {
        response.end();
        return;
    }

    request.setEncoding("utf8");

    var body = "";
    request.on("data", function(chunk) {
        body += chunk;
    });
    request.on("end", function() {
        console.log(GetPrintableTimeStamp() + " Data from portal...");
        console.log(body);

        var result = JSON.parse(body);

        var i, ii, iii, endpoint, resource;

        if (result.notifications) {
            for (i = 0; i < result.notifications.length; i++) {
                var notification = result.notifications[i];

                for (ii = 0; ii < endpoints.length; ii++) {
                    endpoint = endpoints[ii];

                    if (endpoint.name == notification.ep) {
                        for (iii = 0; iii < endpoint.resources.length; iii++) {
                            resource = endpoint.resources[iii];

                            if (resource.uri == notification.path) {
                                //set value
                                resource.value = decodeBase64(notification.payload);
                                resource.timestamp = new Date().getTime();

                                //save
                                insertResourceIntoDb(endpoint, resource);
                            }
                        }
                    }
                }

                //console.log("Notification: " +decodeBase64(notification.payload));
            }
        } else if (result["async-responses"]) {
            var asyncresponses = result["async-responses"];

            for (i = 0; i < asyncresponses.length; i++) {
                var asyncresponse = asyncresponses[i];

                if (asyncresponse.status == 200) {
                    //loop through resources
                    for (ii = 0; ii < endpoints.length; ii++) {
                        endpoint = endpoints[ii];

                        for (iii = 0; iii < endpoint.resources.length; iii++) {
                            resource = endpoint.resources[iii];

                            if (asyncresponse.id == resource["async-response-id"]) {
                                //set value
                                resource.value = decodeBase64(asyncresponse.payload);
                                resource.timestamp = new Date().getTime();

                                //clear id
                                resource["async-response-id"] = undefined;

                                //save
                                insertResourceIntoDb(endpoint, resource);
                            }
                        }
                    }
                }
            }
        }

        response.writeHead(200, {"content-type": "text/plain"});
        response.write("Blobby");
        response.end();
    });

}).listen(settings.ds_port, "0.0.0.0", 511, function() {
    console.log("IoT Notification Listener started at " + settings.url + ":" + settings.ds_port + "/");
    startup();
});

var endpoints = [];
function getEndpoints() {
    console.log("Retrieving endpoints...");
    var rq = https.request(
        {
            host    : settings.ds_url,
            path    : "/endpoints/",
            method  : "GET",
            headers: {
                Authorization: "Bearer " + settings.ds_auth
            }
        },
        function(res) {
            console.log("Endpoint retrieval status: " + res.statusCode);
            var body = "";
            res.on("data", function(chunk) {
                body += chunk;
            });
            res.on("end", function() {
                console.log("Endpoint retrieval body: " + body);
                endpoints = JSON.parse(body);

                for (var i = 0; i < endpoints.length; i++) {
                    var endpoint = endpoints[i];

                    getResources(endpoint);
                }
            });
        }
    );
    rq.end();
    rq.on("error", function(err) {
        console.log("Error Endpoints: " + err);
    });
}

function getResources(endpoint) {
    var rq = https.request(
        {
            host    : settings.ds_url,
            path    : "/endpoints/" + endpoint.name + "/",
            method  : "GET",
            headers: {
                Authorization: "Bearer " + settings.ds_auth
            }
        },
        function(res) {
            console.log("Resources Status: " + res.statusCode);
            var body = "";
            res.on("data", function(chunk) {
                body += chunk;
            });
            res.on("end", function() {
                console.log(body);
                endpoint.resources = JSON.parse(body);
            });
        }
    );
    rq.end();
    rq.on("error", function(err) {
        console.log("Error Resources: " + err);
    });
}

function getResource(endpoint, resource) {
    var rq = https.request(
        {
            host    : settings.ds_url,
            path    : "/endpoints/" + endpoint.name + resource.uri,
            method  : "GET",
            headers: {
                Authorization: "Bearer " + settings.ds_auth
            }
        },
        function(res) {
            console.log(GetPrintableTimeStamp() + " GetResource " + resource.uri + " Status " + (typeof res.statusCode) + ": "  + res.statusCode);
            var body = "";
            res.on("data", function(chunk) {
                body += chunk;
            });
            res.on("end", function() {
                console.log("Getting resource " + resource.uri + "..");
                console.log(body);

                if (res.statusCode == 200 || res.statusCode == 202) {
                    try {
                        result  = JSON.parse(body);

                        if (typeof result == "string" || typeof result == "number") {
                            resource.value = "" + result; //set value
                            resource.timestamp = new Date().getTime();

                            //save
                            insertResourceIntoDb(endpoint, resource);
                        } else if (typeof result == "object") {
                            if (result["async-response-id"]) {
                                resource["async-response-id"] = result["async-response-id"];
                            }
                        }
                    } catch (e) {
                        if (typeof body == "string") {
                            resource.value = "" + body; //set value
                            resource.timestamp = new Date().getTime();

                            //save
                            insertResourceIntoDb(endpoint, resource);
                        }
                    }
                } else {
                    //check for error
                    checkForError(endpoint, resource, body);

                    //log error
                    var error = {
                        time: GetPrintableTimeStamp(new Date().getTime()),
                        status: res.statusCode,
                        endpoint: endpoint.name,
                        resource: resource.uri,
                        body: body
                    };

                    addError(error);
                }
            });
        }
    );
    rq.end();
    rq.on("error", function(err) {
        console.log(GetPrintableTimeStamp() + "Error GetResource: " + err);
    });
}

function putResource(endpoint, resource, value, callback) {
    var rq = https.request(
        {
            host    : settings.ds_url,
            path    : "/endpoints/" + endpoint.name + resource.uri,
            method  : "PUT",
            headers: {
                Authorization: "Bearer " + settings.ds_auth,
                "content-type": "application/json"
            }
        },
        function(res) {
            console.log(GetPrintableTimeStamp() + " Put value: " + res.statusCode);
            var body = "";
            res.on("data", function(chunk) {
                body += chunk;
            });
            res.on("end", function() {
                console.log(body);

                callback(res.statusCode, body);
            });
        }
    );
    rq.write("" + value);
    rq.end();
    rq.on("error", function(err) {
        console.log("Error put value : " + err);
    });
}

var nonotificationchannelcount = 0;
var nonotificationchannelresetlimit = 10;
function checkForError(endpoint, resource, message) {
    if (message.toLowerCase().indexOf("no notification channel") >= 0) {
        nonotificationchannelcount += 1;

        if (nonotificationchannelcount >= nonotificationchannelresetlimit) {
            //reset count
            nonotificationchannelcount = 0;

            //call reset on devices
            resetEndpoints();
        }
    } else if (message.toLowerCase().indexOf("queue is full for") >= 0) {
        resource.skip += 30;
    }
}

function resetEndpoints() {
    for (var i = 0; i < endpoints.length; i++) {
        var endpoint = endpoints[i];

        for (var ii = 0; ii < endpoint.resources.length; ii++) {
            var resource = endpoint.resources[ii];

            if (resource.uri.toLowerCase().indexOf("reset") >= 0) {
                resetResource(endpoint.name, resource.uri, function(status, body) {
                    console.log(GetPrintableTimeStamp() + " Reset: " + status + " : " + body);

                    //add to log
                    var error = {
                        status: status,
                        action: "RESET",
                        body: body
                    };

                    addError(error);
                });
            }
        }
    }
}

function resetResource(endpointName, deviceURI, callback) {
    //attempt to reset
    var error = {
        time: GetPrintableTimeStamp(new Date().getTime()),
        action: "RESET",
        endpoint: endpointName,
        resource: deviceURI
    };

    addError(error);

    //reset
    var rq = https.request(
        {
            host    : settings.ds_url,
            path    : "/endpoints/" + endpointName + deviceURI + "/RESET",
            method  : "PUT",
            headers: {
                Authorization: "Bearer " + settings.ds_auth,
                "content-type": "application/json"
            }
        },
        function(res) {
            var body = "";
            res.on("data", function(chunk) {
                body += chunk;
            });
            res.on("end", function() {
                callback(res.statusCode, body);
            });
        }
    );
    rq.write("1");
    rq.end();
    rq.on("error", function(err) {
        console.log("Error reset : " + err);
        callback(500, err);
    });
}

// -------- Subscribe ---------
function subsribe(successCB) {
    var o = [
        //{
            //"endpoint-name": "a0c50f17-62a8-4dcc-8e7b-bb147cb53b50*"
        //}
    ];
    var rq = https.request(
        {
            host    : settings.ds_url,
            path    : "/subscriptions/",
            method  : "PUT",
            headers: {
                Authorization: "Bearer " + settings.ds_auth,
                "content-type": "application/json"
            }
        },
        function(res) {
            console.log("Subscribe status: " + res.statusCode);
            if (res.statusCode == 204) {
                successCB();
            }
        }
    );
    rq.write(JSON.stringify(o));
    rq.end();
    rq.on("error", function(err) {
        console.log(GetPrintableTimeStamp() + " Error subscribe : " + err);
    });
}

// -------- Get Current Subscription ---------
function getSubscriptions(successCB) {
    var rq = https.request(
        {
            host    : settings.ds_url,
            path    : "/subscriptions/",
            method  : "GET",
            headers: {
                Authorization: "Bearer " + settings.ds_auth
            }
        },
        function(res) {
            console.log("Get Subscribe: " + res.statusCode);
            var body = "";
            res.on("data", function(chunk) {
                body += chunk;
            });
            res.on("end", function() {
                successCB(body);
            });
        }
    );
    rq.end();
    rq.on("error", function(err) {
        console.log("Error get subscription: " + err);
    });
}

// -------- DEREGISTER CALLBACKS ---------
function deregister(successCB) {
    console.log("De-registering any existing callback");
    var rq = https.request(
        {
            host    : settings.ds_url,
            path    : "/notification/callback",
            method  : "DELETE",
            headers: {
                Authorization: "Bearer " + settings.ds_auth
            }
        },
        function(res) {
            if (res.statusCode == 204) {
                console.log("Succesfully un-registered callback");
                successCB();
            } else if (res.statusCode == 404) {
                console.log("Nothing to de-register");
                successCB();
            } else {
                console.log("Error un-registering callback : " + res.statusCode);
                var body = "";
                res.on("data", function(chunk) {
                    body += chunk;
                });
                res.on("end", function() {
                    console.log(body);
                });
            }
        }
    );
    rq.end();
    rq.on("error", function(err) {
        console.log("Error un-registering callback : " + err);
    });
}

// -------- REGISTER AS CALLBACK --------
function register(successCB) {
    console.log("Registering callback");
    var o = {
        url: "http://" + settings.url + ":" + settings.ds_port,
        headers: {
            "Authorization": "auth",
            "test-header": "test"
        }
    };
    var rq = https.request(
        {
            host    : settings.ds_url,
            path    : "/notification/callback",
            method  : "PUT",
            headers: {
                Authorization: "Bearer " + settings.ds_auth,
                "content-type": "application/json"
            }
        },
        function(res) {
            if (res.statusCode == 204) {
                console.log("Succesfully registered callback");
                successCB();
            } else {
                console.log("Error registering callback : " + res.statusCode);
                var body = "";
                res.on("data", function(chunk) {
                    body += chunk;
                });
                res.on("end", function() {
                    console.log(body);
                });
            }
        }
    );
    rq.write(JSON.stringify(o));
    rq.end();
    rq.on("error", function(err) {
        console.log("Error registering callback : " + err);
    });
}

// -------- GET REGISTERED CALLBACK --------
function getRegisterCallback(successCB) {
    var rq = https.request(
        {
            host    : settings.ds_url,
            path    : "/notification/callback",
            method  : "GET",
            headers: {
                Authorization: "Bearer " + settings.ds_auth
            }
        },
        function(res) {
                var body = "";
                res.on("data", function(chunk) {
                    body += chunk;
                });
                res.on("end", function() {
                    successCB(JSON.parse(body));
                });
        }
    );
    rq.end();
    rq.on("error", function(err) {
        console.log("Error getting registering callback : " + err);
    });
}

// --------------------------------------

// HTTP server (for XpertRule Web Author API)
var xr_server = http.createServer(function(request, response) {

    // parse the URL (busting up the search params too)
    var params = url.parse(request.url, true);

    request.setEncoding("utf8");

    var body = "";
    request.on("data", function(chunk) {
        body += chunk;
    });
    request.on("end", function() {
        console.log(GetPrintableTimeStamp());
        console.log("XpertRule API request");

        var r = {
            status: "OK"
        };

        var url = params.pathname;
        var urlarray = url.split("/");

        urlarray.splice(0, 1);    //remove first blank

        var endpointuri, resourceuri;

        //resource
        if (urlarray.length >= 3 && urlarray[0] == "history") {   //catch history tag
            urlarray.splice(0, 1);    //remove history

            //endpoint - resource
            endpointuri = urlarray[0];
            urlarray.splice(0, 1);    //remove endpoint
            resourceuri = "/" + urlarray.join("/");

            //limit
            var limit = params.query.limit;
            if (limit) {
                limit = parseInt(limit);
            } else {
                limit = 100;
            }

            //sort
            var sort = params.query.sort;
            if (sort) {
                if (sort == "asc") {
                    sort = 1;
                } else if (sort == "desc") {
                    sort = -1;
                } else {
                    sort = parseInt(sort);
                }
            } else {
                sort = -1;
            }

            var starttime;
            var endtime;

            //end day
            var endday = params.query.endday;
            if (endday) {
                endtime = new Date().getTime() - endday * 24 * 60 * 60 * 1000;
            }

            //start day
            var startday = params.query.startday;
            if (startday) {
                starttime = new Date().getTime() - startday * 24 * 60 * 60 * 1000;
            }

            //nr of days
            var days = params.query.days;
            if (days) {
                if (starttime && !endtime) {
                    endtime = starttime + days * 24 * 60 * 60 * 1000;
                } if (!starttime && endtime) {
                    starttime = endtime - days * 24 * 60 * 60 * 1000;
                } else if (!starttime && !endtime) {
                    endtime = new Date().getTime();
                    starttime = endtime - days * 24 * 60 * 60 * 1000;
                }
            }

            //pass timestamp
            var endtimestamp = params.query.endtimestamp;
            if (endtimestamp) {
                endtime = endtimestamp;
            }

            var starttimestamp = params.query.starttimestamp;
            if (starttimestamp) {
                starttime = starttimestamp;
            }

            //query db
            selectResourceFromDB(endpointuri, resourceuri, starttime, endtime, limit, sort, function(items) {
                response.writeHead(200, {"content-type": "text/plain"});
                response.write(JSON.stringify(items));
                response.end();
            });
        } else if (urlarray.length >= 2) {  // getting resource from ram or setting resource value
            endpointuri = urlarray[0];
            urlarray.splice(0, 1);    // remove endpoint
            resourceuri = "/" + urlarray.join("/");

            console.log("Endpoint: " + endpointuri);
            console.log("Resource: " + resourceuri);

            var foundendpoint = false;
            var foundresource = false;

            for (var i = 0; i < endpoints.length; i++) {
                var endpoint = endpoints[i];

                if (endpointuri.indexOf(endpoint.name) >= 0) {
                    foundendpoint = true;

                    for (var ii = 0; ii < endpoint.resources.length; ii++) {
                        var resource = endpoint.resources[ii];

                        if (resourceuri.indexOf(resource.uri) >= 0) {
                            foundresource = true;

                            if (request.method.toLowerCase() == "put") {
                                console.log("Set Value: " + body);
                                putResource(endpoint, resource, body, function(code, result) {
                                    r.response = result;

                                    response.writeHead(code, {"content-type": "text/plain"});
                                    response.write(JSON.stringify(r));
                                    response.end();
                                });
                            } else {
                                r.value = resource.value;

                                if (r.value) {
                                    //set age if value
                                    r.age = (new Date().getTime()) - resource.timestamp;
                                }

                                response.writeHead(200, {"content-type": "text/plain"});
                                response.write(JSON.stringify(r));
                                response.end();
                            }
                        }
                    }
                }
            }

            if (!foundendpoint || !foundresource) {
                r.status = "ERROR";
                r.error = "Endpoint (" + foundendpoint + ") or resource (" + foundresource + ") not found.";
                console.log(r.error);
                response.writeHead(200, {"content-type": "text/plain"});
                response.write(JSON.stringify(r));
                response.end();
            }
        } else {
            response.writeHead(200, {"content-type": "text/plain"});
            response.write(JSON.stringify(r));
            response.end();
        }
    });

}).listen(settings.xr_port, "0.0.0.0", 511, function() {
    console.log("Web Author API started at " + settings.url + ":" + settings.xr_port + "/");
});

// ------------------------------------

// STARTUP (should be called once the callback server is up and running)
function startup() {
    //resetResource("a0c50f17-62a8-4dcc-8e7b-bb147cb53b50", "/Test/0", function(status, body) {
    //   console.log(GetPrintableTimeStamp() + " Reset: " + status + " : " + body);
    //});

    getEndpoints();

    deregister(function() {
        register(function() {
            console.log("Resource listener started");

            getRegisterCallback(function(res) {
                console.log("Checking the registered callback...");
                console.log(res);
            });

            subsribe(function() {
                getSubscriptions(function(res) {
                    console.log("Checking subscription...");
                    console.log(res);
                });
            });
        });
    });

    // get resources
    var time = settings.poll_time * 1000;
    console.log("Polling resources every " + time + "ms");
    setInterval(function() {
        console.log("Poll resources");

        for (var i = 0; i < endpoints.length; i++) {
            var endpoint = endpoints[i];

            for (var ii = 0; ii < endpoint.resources.length; ii++) {
                var resource = endpoint.resources[ii];

                if (resource.obs == true || (resource.rt && resource.rt != "")) {
                    if (!resource.skip) {
                        resource.skip = 0;
                    }

                    console.log(GetPrintableTimeStamp() + " Resource: " + resource.uri + " : " + resource.value + " : " + (resource.timestamp != undefined ? GetPrintableTimeStamp(resource.timestamp) : "") + " : " + resource.skip);

                    if (resource.skip > 0) {
                        resource.skip -= 1;
                    } else {
                        getResource(endpoint, resource);
                    }
                }
            }
        }
    }, time);

    //start error logging
    startErrorLoggin();

    /*
    //debugging stuff
    var time2 = 60 * 1000;
    setInterval(function() {
        console.log("Debug Interval(" + time2 + "ms)");

        //get register
        getRegisterCallback(function(res) {
            console.log("Checking the registered callback...");
            console.log(res);
        });

        //get subscription
        getSubscriptions(function(res) {
            console.log("Checking subscription...");
            console.log(res);
        });
    }, time2);
    */
}

// ------------------------------------

//decode
decodeBase64 = function(s) {
    var e = {}, i, b = 0, c, x, l = 0, a, r = "", w = String.fromCharCode, L = s.length;
    var A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (i = 0; i < 64; i++) {
        e[A.charAt(i)] = i;
    }
    for (x = 0; x < L; x++) {
        c = e[s.charAt(x)];
        b = (b << 6) + c;
        l += 6;
        while (l >= 8) {
            ((a = (b >>> (l -= 8)) & 0xff) || (x < (L - 2))) && (r += w(a));
        }
    }
    return r;
};

// ------------------------------------

process.on("uncaughtException", function(e) {
    if (typeof e != "string") {
        e = util.inspect(e);
    }
    console.log(GetPrintableTimeStamp() + " Uncaught Exception : " + e);
});

// -------- Log errors ---------
var errors = [];
var loggingerror;   //for locking

function startErrorLoggin() {
    var time = 60 * 1000;
    setInterval(function() {
        logNextError();
    }, time);
}

function logNextError() {
    if (errors.length > 0 && !loggingerror) {
        try {
            loggingerror = true;                //add lock
            fs.appendFile("errorlog.txt", JSON.stringify(errors[0]) + "\r\n" + "\r\n", function(err) {
                loggingerror = false;           //release lock

                if (err) {
                    throw err;
                }

                errors.splice(0, 1);            //remove this error
                logNextError();                 //log next one
            });
        } catch (e) {
            console.log("Log error: " + e);
        }
    }
}

function addError(error) {
    errors.push(error);
}
