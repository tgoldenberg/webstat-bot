var validUrl = require('valid-url');
var parseDomain = require('parse-domain');
var RtmClient = require('@slack/client').RtmClient;
var RestClient = require('node-rest-client').Client;

var findData = require('./mongoQuery').findData;
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
  if (/development/.test(text)){
    CONNECTION_STRING = developmentCreds;
    sendTypingMessage();
    findData(CONNECTION_STRING, (res) => {
      console.log('RESULT', res);
      console.log('CHANNEL', channel);
      slackClient.sendMessage('HELLO', channel);
    });
  } else {
    CONNECTION_STRING = stageCreds;
    sendTypingMessage();
    findData(CONNECTION_STRING, (res) => {
      slackClient.sendMessage(res, channel);
    });

  }
});

slackClient.start();
