var express = require('express')
var app = express()
var pgp = require('pg-promise')()
var QueryStream = require('pg-query-stream');
var JSONStream = require('JSONStream');
var wkx = require('wkx')
var through = require('through')
var db = pgp({});
var pg = require('pg')

var SQL = "select * from ons_lad"
//
// completely synchronous
//
app.get('/sync', function (req, res) {
    var count = 0;
    var query = db.any(SQL, [])
    query.then(data => {
        res.send(JSON.stringify(data));
    })
});

//
// stream raw data from the database into the response
//
app.get('/streamraw', (req, res) => {
    res.set('Content-Type', 'text/plain');
    var qs = new QueryStream(SQL);
    db.stream(qs, rows => {
        rows.pipe(JSONStream.stringify()).pipe(res);
    })
    .then(data => {
        res.end();
    })
});

//
// strip out the geom column as they pass (for perf comparison)
//
function stripGeom(){
    return through(function write(row) {
        delete row['geom']
        this.queue(row)
    }, function end(){
        this.queue(null);
    });
}

app.get('/streamstrip', (req, res) => {
    res.set('Content-Type', 'text/plain');
    var qs = new QueryStream(SQL);  // no limit!
    db.stream(qs, rows => {
        rows.pipe(stripGeom()).pipe(JSONStream.stringify()).pipe(res);
    })
    .then(data => {
        res.end();
    })
});

//
// convert the data as they pass into geojson
//
function convert(){
    return through(function write(row) {
        row['geom'] = wkx.Geometry.parse(new Buffer(row['geom'], 'hex')).toGeoJSON()
        this.queue(row)
    }, function end(){
        this.queue(null);
    });
}

app.get('/streamjson', (req, res) => {
    res.set('Content-Type', 'text/plain');
    var qs = new QueryStream(SQL);
    db.stream(qs, rows => {
        rows.pipe(convert()).pipe(JSONStream.stringify()).pipe(res);
    })
    .then(data => {
        res.end();
    })
});

//
// Use node pg directly accumulate the rows and send at once
//
app.get('/pgsync', (req, res) => {
    console.log('entry')
    res.set('Content-Type', 'text/plain');
    var client = new pg.Client()
    client.connect();
    var query = client.query(SQL);
    var rows = []
    query.on('row', row => {
        rows += JSON.stringify(row);
    });
    query.on('end', results => {
        console.log('end')
        res.send(rows);
    });
});


//
// Use node pg directly send the rows as they arrive
//
app.get('/pgstream', (req, res) => {
    console.log('entry')
    res.set('Content-Type', 'text/plain');
    var client = new pg.Client()
    client.connect();
    var query = client.query(SQL);
    var count = 0;
    query.on('row', row => {
        res.write(count == 0 ? '[' : ',');
        res.write(JSON.stringify(row));
        count += 1;
    });
    query.on('end', results => {
        res.end()
    });
});


//
// Use node pg directly send the rows as they arrive
// remove the geoms as we go
//
app.get('/pgstreamstrip', (req, res) => {
    console.log('entry')
    res.set('Content-Type', 'text/plain');
    var client = new pg.Client()
    client.connect();
    var query = client.query(SQL);
    var count = 0;
    query.on('row', row => {
        delete row['geom']
        res.write(count == 0 ? '[' : ',');
        res.write(JSON.stringify(row));
        count += 1;
    });
    query.on('end', results => {
        res.end()
    });
});

//
// Use node pg with pooled connections directly send the rows as they arrive
//
//
var Pool = require('pg-pool')
var poolConfig = {max: 5, min: 1}
var pool = new Pool(poolConfig);


app.get('/pgpoolstream', (req, res) => {
    res.set('Content-Type', 'text/plain');
    pool.connect(function(err, client, release){        // get a connection from the pool
        query = client.query(SQL);                      // run the query
        var count = 0;
        query.on('row', row => {                        // process the rows to json array
            delete row['geom']
            res.write(count == 0 ? '[\n' : ',\n');
            res.write(JSON.stringify(row));
            count += 1;
        });
        query.on('end', results => {
            console.log('release')
            res.write(']\n')                            // close the array
            res.end()                                   // close the response
            client.release();                                  // return the db connection
        });
    });
});







app.listen(3000, function () {
  console.log('listening on port 3000')
})
