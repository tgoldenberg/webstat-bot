var validUrl = require('valid-url');
var parseDomain = require('parse-domain');
var RtmClient = require('@slack/client').RtmClient;
var RestClient = require('node-rest-client').Client;
var cron = require('node-cron');
var findData = require('./mongoQuery').findData;

var testClustering = require('./testClustering').testClustering;
var testInitialPageLoad = require('./initialPageLoad').testInitialPageLoad;
var developmentCreds = require('./secrets').developmentCreds;
var stageCreds = require('./secrets').stageCreds;

var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
var RTM_EVENTS = require('node-rest-client').RTM_EVENTS;
var SlackSecret = require('./secrets');

var MAX_REQUEST_RATE_MS = 5000;

var SLACK_TOKEN = SlackSecret.slackToken();
console.log('SLACK TOKEN', SLACK_TOKEN);

var LOG_LEVEL = 'warn';
var slackClient = new RtmClient(SLACK_TOKEN, { logLevel: LOG_LEVEL });
var restClient = new RestClient();

var BOT;
var BOT_MENTION_REGEX;

slackClient.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function(rtmStartData){
  BOT = rtmStartData.self.id;
  BOT_MENTION_REGEX = new RegExp('<@' + BOT + '>', 'g');
  console.log('ID', BOT, BOT_MENTION_REGEX);
});

var CONNECTION_STRING;

var InitialPageLoadTask = cron.schedule('* * * * *', function() {
  var channel = 'C2PGA3VLM';
  let promise = new Promise((resolve, reject) => {
    testInitialPageLoad('development').then(message => {
      slackClient.sendMessage('Results for development initial page load...', channel);
      slackClient.sendMessage(message, channel);
      resolve();
    })
    .catch(err => {
      console.log('ERR', err);
      resolve();
    })
  });
  promise.then(() => {
    let p2 = new Promise((resolve, reject) => {
      testInitialPageLoad('staging').then(message => {
        console.log('MESSAGE', message);
        slackClient.sendMessage('Results for staging initial page load...', channel);
        slackClient.sendMessage(message, channel);
        resolve();
      })
      .catch(err => {
        console.log('ERR', err);
        resolve();
      })
    })
    p2.then(() => {
      testClustering('production').then(message => {
        console.log('MESSAGE', message);
        slackClient.sendMessage('Results for production initial page load...', channel);
        slackClient.sendMessage(message, channel);
      })
      .catch(err => {
        console.log('ERR', err);
      })
    })
  })
});

var ClusteringTask = cron.schedule('48 14 * * *', function() {
  var channel = 'C2PGA3VLM';
  let promise = new Promise((resolve, reject) => {
    testClustering('development').then(message => {
      console.log('MESSAGE', message);
      slackClient.sendMessage('Results for development clustering...', channel);
      slackClient.sendMessage(message, channel);
      resolve();
    })
    .catch(err => {
      console.log('ERR', err);
      resolve();
    })
  })
  promise.then(() => {
    let p2 = new Promise((resolve, reject) => {
      testClustering('staging').then(message => {
        console.log('MESSAGE', message);
        slackClient.sendMessage('Results for staging clustering...', channel);
        slackClient.sendMessage(message, channel);
        resolve();
      })
      .catch(err => {
        console.log('ERR', err);
        resolve();
      })
    })
    p2.then(() => {
      testClustering('production').then(message => {
        console.log('MESSAGE', message);
        slackClient.sendMessage('Results for production clustering...', channel);
        slackClient.sendMessage(message, channel);
      })
      .catch(err => {
        console.log('ERR', err);
      })
    })
  })
});

ClusteringTask.start();
InitialPageLoadTask.start();

slackClient.on('message', function(message){
  console.log('MESSAGE', message);
  var text = message.text;
  var channel = message.channel;
  var sendTypingMessage = function(){
    slackClient._send({
      id: 1,
      type: 'typing',
      channel: channel
    });
  };
  console.log('CHANNEL', channel);
  if (BOT_MENTION_REGEX.test(text)){
    if (/clustering development/.test(text)){
      /* Find how quickly clustering works for a development feed */
      console.log('DEVELOPMENT SLACKBOT', text);
      sendTypingMessage();
      testClustering('development').then(message => {
        console.log('MESSAGE', message);
        slackClient.sendMessage(message, channel);
      })
      .catch(err => {
        console.log('ERR', err);
      })
    } else if (/clustering staging/.test(text)) {
      /* Find how quickly clustering works for a staging feed */
      console.log('STAGING SLACKBOT', text);
      sendTypingMessage();
      testClustering('staging').then(message => {
        console.log('MESSAGE', message);
        slackClient.sendMessage(message, channel);
      })
      .catch(err => {
        console.log('ERR', err);
      })
    } else if (/clustering production/.test(text)) {
      /* Find how quickly clustering works for a production feed */
      console.log('PRODUCTION SLACKBOT', text);
      sendTypingMessage();
      testClustering('production').then(message => {
        console.log('MESSAGE', message);
        slackClient.sendMessage(message, channel);
      })
      .catch(err => {
        console.log('ERR', err);
      })
    }
  }

});

slackClient.start();
