var fs = require('fs-extra');
var Promise = require('promise');
var supplant = require('./supplant');
var walkdir = require('walkdir');
var p = require('path');
var mm = require('musicmetadata');
var async = require('async');
var uuid = require('node-uuid');
var moment = require('moment');
var os = require('os'),
    EOL = os.EOL;

var itemTemplate = fs.readFileSync('./assets/FeedItemTemplate.xml', "utf8");
var feedTemplate = fs.readFileSync('./assets/FeedHeaderTemplate.xml', "utf8");

//console.log(feedTemplate);
//console.log(itemTemplate);

//var a = "Hello Mr. {first} {last}. How's life in {address.city}, {address.state} ?";

//console.log(a.supplant({first: 1}));
//console.log(String.supplant);


exports.feed = feed;

function feed(path) {
    console.log(path);

    var prefix = '{prefix}';

    var cover = findCover() || ''; //todo: add default cover
    cover = prefix + p.relative(path, cover);
    console.log('Found cover', cover);

    var pubDate = moment();

    var feedMetadata = {
        date: pubDate.toISOString(),
        title: p.basename(path),
        description: 'here be dragons',
        thumbnail: cover
    };

    var feedData;

    // get individual files and generate metadata records for them
    var items = walkdir
        .sync(path, {
            no_recurse: true
        })
        .filter(function (file) {
            return p.extname(file) === '.mp3';
        })
        .sort(); // sorts file names just in case

    return new Promise(function (fulfill, reject) {
        async.mapSeries(items,
            generateRecord,
            function (err, results) {
                if (err) {
                    console.error(err);
                }

                //console.log(results.join(EOL));
                feedMetadata.items = results.join(EOL);
                feedData = feedTemplate.supplant(feedMetadata);

                fulfill(feedData);
                //console.log(feedData);
                fs.outputFile('feedData.xml', feedData, function () { });
            });
    });

    function generateRecord(item, callback) {
        mm(fs.createReadStream(item),
            function (err, metadata) {
                if (err) {
                    throw err;
                }
                //console.log(metadata);
                metadata.guid = uuid.v4();
                metadata.filelink = prefix + p.relative(path, item);
                metadata.size = fs.statSync(item).size;
                metadata.thumbnail = cover;
                metadata.pubDate = pubDate.toISOString();
                pubDate.add(1, 'day');

                callback(null, itemTemplate.supplant(metadata).trim());
            });
    }

    function findCover() {
        return walkdir.sync(path, {
            no_recurse: true
        })
            .find(function (file) {
                // find first image; assume it's a cover
                return /.*?\.(png|jpg)/.test(p.extname(file));
            });
    }
};

