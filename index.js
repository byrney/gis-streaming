var express = require('express')
var app = express()
var pgp = require('pg-promise')()
var QueryStream = require('pg-query-stream');
var JSONStream = require('JSONStream');
var wkx = require('wkx')
var through = require('through')
var db = pgp({});

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


app.listen(3000, function () {
  console.log('listening on port 3000')
})
