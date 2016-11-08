var mongodb = require('mongodb');
var rp = require('request-promise');
var moment = require('moment');
var _ = require('underscore');

var MongoClient = mongodb.MongoClient;

var DEVELOPMENT = {
  MONGO_URL: process.env.DEVELOPMENT_MONGO_URL,
  USER_ID: 'QRpriCSDvCbK9tJu8',
  USER_EMAIL: 'monitoring@agolo.com',
  PERCOLATOR_ENDPOINT: process.env.DEVELOPMENT_PERCOLATOR_ENDPOINT,
  RABBITMQ_CONNECTION_STRING: process.env.DEVELOPMENT_RABBITMQ_CONNECTION_STRING,
};
var STAGING = {
  MONGO_URL: process.env.STAGING_MONGO_URL,
  USER_ID: 'YNqK9u2dxhcmJ727H',
  USER_EMAIL: 'monitoring@agolo.com',
  PERCOLATOR_ENDPOINT: process.env.STAGING_PERCOLATOR_ENDPOINT,
  RABBITMQ_CONNECTION_STRING: process.env.STAGING_RABBITMQ_CONNECTION_STRING,
};
var PRODUCTION = {
  MONGO_URL: process.env.PRODUCTION_MONGO_URL,
  USER_ID: 'Eq2zdhhuEoNFxbPKQ',
  USER_EMAIL: 'monitoring@agolo.com',
  PERCOLATOR_ENDPOINT: process.env.PRODUCTION_PERCOLATOR_ENDPOINT,
  RABBITMQ_CONNECTION_STRING: process.env.PRODUCTION_RABBITMQ_CONNECTION_STRING,
};

var testInitialPageLoad = function(environment) {
  let promise = new Promise((resolve, reject) => {
    var envArg = 'development'
    if (environment) {
      envArg = environment;
    } else {
      envArg = process.argv[2];
    }
    console.log('PROCESS', process.env.DEVELOPMENT_MONGO_URL);
    var missingArgs = false;
    var env, Feed, Cluster;
    if (envArg === 'development') {
      env = DEVELOPMENT;
    } else if (envArg === 'staging') {
      env = STAGING;
    } else if (envArg === 'production') {
      env = PRODUCTION;
    } else {
      console.log('Must provide an argument for the environment [development|staging|production]');
      env = DEVELOPMENT;
      missingArgs = true;
    }

    MongoClient.connect(env.MONGO_URL, {native_parser: true}, (err, db) => {
      if (err) { console.log('ERR:', err); }
      else {
        if (missingArgs) {
          db.close();
          return;
        }
        console.log('ENV', env);
        /* Construct Feed Data */
        var LoadSpeeds = db.collection('loadSpeeds');
        var day = new Date();
        var date = day.getDate();
        day.setDate(date - 1);
        day.setHours(0);
        day.setMinutes(0);
        day.setMilliseconds(0);
        var nextDay = new Date(date.valueOf());
        nextDay.setDate(date);
        var count = LoadSpeeds.find({ date: { $gte: day.valueOf() }}).count();
        LoadSpeeds.aggregate([
          {
            $match: {
              date: { $gte: day.valueOf() }
            }
          },
          {
            $group: {
              _id: null,
              "avg_speed": { $avg: "$DOMLoaded" }
            }
          }
        ], function(err, res) {
          if (res && res[0] && res[0].avg_speed) {
            var message = `
Just tested average initial page load for ${envArg} environment. Here are the results! \n
> Average initial page load: *${res[0].avg_speed/1000}seconds}*
> Compiled from *${count}* cases
👍
`;
            resolve(message);
            console.log('RESULT', res[0].avg_speed /1000);
          } else {
            var message = `
That's strange.
> I couldn't find any page views for ${envArg} environment.
> Unable to determine average initial page load speed.
😞
`;
            resolve(message);
          }
          db.close();
        })
      }
    });
  });
  return promise;
};

// testInitialPageLoad('development');
module.exports = {
  testInitialPageLoad,
};
