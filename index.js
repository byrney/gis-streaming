var express = require('express')
var app = express()
var pgp = require('pg-promise')()
var QueryStream = require('pg-query-stream');
var JSONStream = require('JSONStream');
var wkx = require('wkx')
var through = require('through')
var db = pgp({});

var SQL = "select * from ons_lsoa"
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
    var qs = new QueryStream(SQL);
    res.set('Content-Type', 'text/plain');
    db.stream(qs, stream => {
        stream.pipe(JSONStream.stringify()).pipe(res);
    })
    .then(data => {
        res.end();
    })
});

//
// strip out the geom column as they pass (for perf comparison)
//
function stripGeom(){
    return through(function write(data) {
        delete data['geom']
        this.queue(data)
    }, function end(){
        this.queue(null);
    });
}

app.get('/streamstrip', (req, res) => {
    var qs = new QueryStream(SQL);  // no limit!
    res.set('Content-Type', 'text/plain');
    db.stream(qs, stream => {
        stream.pipe(stripGeom()).pipe(JSONStream.stringify()).pipe(res);
    })
    .then(data => {
        res.end();
    })
});

//
// convert the data as they pass into geojson
//
function convert(){
    return through(function write(data) {
        data['geom'] = wkx.Geometry.parse(new Buffer(data['geom'], 'hex')).toGeoJSON()
        this.queue(data)
    }, function end(){
        this.queue(null);
    });
}

app.get('/streamjson', (req, res) => {
    var qs = new QueryStream(SQL);
    res.set('Content-Type', 'text/plain');
    db.stream(qs, stream => {
        stream.pipe(convert()).pipe(JSONStream.stringify()).pipe(res);
    })
    .then(data => {
        res.end();
    })
});


app.listen(3000, function () {
  console.log('listening on port 3000')
})
