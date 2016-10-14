var mongodb = require('mongodb');
var cuid = require('cuid');
var rp = require('request-promise');
var moment = require('moment');
var PERCOLATOR_USERNAME = 'agolo';
var PERCOLATOR_PASSWORD = 'kAiyALrdpLVyd6Juvn6d';
var btoa = require('btoa');
var _ = require('underscore');
var PERCOLATOR_AUTH = btoa(`${PERCOLATOR_USERNAME}:${PERCOLATOR_PASSWORD}`);

var Elastic = require('../../server/methods/feeds/ElasticSearch');
var PERCOLATOR_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Basic ${PERCOLATOR_AUTH}`
};

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
  USER_ID: '',
  USER_EMAIL: 'monitoring@agolo.com',
  PERCOLATOR_ENDPOINT: process.env.PRODUCTION_PERCOLATOR_ENDPOINT,
  RABBITMQ_CONNECTION_STRING: process.env.PRODUCTION_RABBITMQ_CONNECTION_STRING,
};

function queryClusters(collection, feedId, db, createdAt, callback) {
  console.log('Collection', feedId, createdAt);
  var interval = setInterval(() => {
    collection.count({ feed_id: feedId }, function(err, count) {
      console.log('COUNT', count);
      if (count > 0) {
        clearInterval(interval);
        console.log('Found clusters for Feed ID ', feedId);
        var diff = new Date().valueOf() - createdAt.valueOf();
        console.log('Time diff: ', (diff/1000) + ' seconds');
        collection.deleteOne({_id: feedId}, (err, res) => {
          callback();
        })
      }
    })
  }, 5000)
  setTimeout(() => {
    clearInterval(interval);
    console.log('Could not find any clusters in last 10 minutes.');
    callback();
  }, 1000*60*10)
}
var missingArgs = false;
var env, Feed, Cluster;
if (process.argv[2] === 'development') {
  env = DEVELOPMENT;
} else if (process.argv[2] === 'staging') {
  env = STAGING;
} else if (process.argv[2] === 'production') {
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
    Feed = db.collection('feeds');
    Cluster = db.collection('clusters');
    console.log('PROCESS', process.argv);

    var testFeed = {
      name                : 'Test',
      userId              : env.USER_ID,
      keywords            : [ {
        label: 'Microsoft',
        value: 'Microsoft',
        type: 'included',
      }],
      selectedSources     : [
        {_id: 'Dow Jones',        isPublisher: true, title: "Dow Jones",               iconUrl: '/images/logos/dow-jones.png', description: ''},
        {_id: 'Bloomberg',        isPublisher: true, title: "Bloomberg",               iconUrl: '/images/logos/bloomberg.png', description: ''},
        {_id: 'Thomson Reuters',  isPublisher: true, title: "Thomson Reuters",         iconUrl: '/images/logos/thomson-reuters.png', description: ''},
        {_id: 'Associated Press', isPublisher: true, title: "Associated Press",        iconUrl: '/images/logos/logo-associated-press.png', description: ''},
      ],
      emailNotifications  : false,
      suggestedKeywords   : [],
    };


    var PERCOLATOR_ENDPOINT = env.PERCOLATOR_ENDPOINT;
    // var { userId, emailNotifications, selectedSources, keywords, suggestedKeywords, name } = testFeed;
    console.log('CONNECTED');
    var user_id     = testFeed.userId;
    var created_at  = new Date();
    var paused      = false;
    var deleted     = false;
    var users       = Elastic.constructUsers(testFeed.userId, testFeed.emailNotifications);
    var sources     = Elastic.constructSources(testFeed.selectedSources);
    var percolatorFields  = ["title^5", "text"];
    var percolatorQuery   = Elastic.constructQuery(testFeed.keywords, testFeed.suggestedKeywords, percolatorFields);
    var feedQueryFields   = ["title^5", "_text_index"];
    var feedQuery         = Elastic.constructQuery(testFeed.keywords, testFeed.suggestedKeywords, feedQueryFields);
    var feedOptions = {
      name: testFeed.name,
      processed: false,
      oneDriveCredentials: [],
      keywords: testFeed.keywords,
      suggestedKeywords: testFeed.suggestedKeywords,
      selectedSources: testFeed.selectedSources,
      _id: cuid(),
      users,
      paused,
      deleted,
      user_id,
      created_at,
      percolatorQuery,
      feedQuery,
      sources,
    };
    /* Save Feed */
    console.log('OPTIONS', feedOptions);
    Feed.insertOne(feedOptions).then(feedId => {
      feedId = feedOptions._id
      console.log('FEED ID', feedId);
      var newFeed = Feed.findOne({ _id: feedId }).then(feed => {
        console.log('NEW FEED', feed);
      })
      /* Update RabbitMQ */
      console.log('Updating RabbitMQ', feedId);
      var creds = env.RABBITMQ_CONNECTION_STRING;
      console.log('CREDS', creds);
      var open = require('amqplib').connect(creds);

      open.then((connection) => {
        return connection.createChannel();
      })
      .then((channel) => {
        return channel.assertQueue('new_feeds').then((ok) => {
          console.log('RabbitMQ status', ok);
          return channel.sendToQueue('new_feeds', new Buffer(feedOptions._id));
        });
      }).catch(console.warn);

      /* Update Percolator */
      console.log('Updating Percolator');

      var params = {
        body: JSON.stringify({
          "query"   : percolatorQuery,
          "sources" : sources
        }),
        headers: PERCOLATOR_HEADERS,
        method: 'PUT',
      };
      console.log('PARAMS', params);
      var response = rp(`${PERCOLATOR_ENDPOINT}/${feedOptions._id}`, params);
      console.log('Percolator response', response.statusCode);
      queryClusters(Cluster, feedId, db, new Date(), (success) => {
        Feed.update({ _id: feedId }, {
          $set: {
            deleted: true
          }
        }).then(() => {
          db.close(true, (err, res) => {
            if (err) { console.log('ERR:', err); }
            process.exit(0);
          });
          return;
        })
      });
    });
  }
});
