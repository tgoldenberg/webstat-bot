var mongodb = require('mongodb');
var moment = require('moment');
let { MongoClient } = mongodb;

var findData = function(connectionString, callback){
  var feeds;
  var logs;
  var msg = '';
  console.log('CONNECTION STRING', connectionString);
  var db = MongoClient.connect(connectionString, (err, db) => {
    if (err) {
      callback(`Error: ${err}`);
    }
    else {
      feeds = db.collection('feeds');
      logs = db.collection('clustering_logs');
      let latestFeeds = feeds.find({}).sort({created_at: -1}).skip(0).limit(10);
      callback('CHECKING LATEST ONLINE CLUSTERING RESULTS...');
      latestFeeds.forEach(feed => {


        let log = logs.find({feed_id: feed._id}).sort({write_to_mongodb: 1}).skip(0).limit(1);
        // let msg2 =`First Log from Spark:`;
        // let msg3 =`Read in Spark: ${moment(log.read_in_spark).format()}`;
        // let msg4 =`Received by Online Clustering: ${moment(log.recv_by_oc).format()}`;
        log.forEach(l => {
          let msg1 = `*Feed: ${feed.name}*  || _${feed._id}_ ---- created at: ${moment(feed.created_at).format('MMMM Do, h:mm a')}, written at: ${moment(new Date(l.write_to_mongodb).valueOf()).format('MMMM Do, h:mm a')}`;
          // let msg5 =`Written to MongoDB: ${moment(l.write_to_mongodb).format('MMMM Do, h:mm ')}`;
          // console.log('WRITTEN AT:', log);
          let createdAt = new Date(feed.created_at).valueOf();
          let writtenAt = new Date(l.write_to_mongodb).valueOf();
          console.log('Created At, Written At', createdAt, writtenAt, feed.name);
          let diff = findDiff(createdAt, writtenAt);
          let msg6 = consoleDiff('Feed Creation', 'First Cluster', diff);
          // let receivedAt = new Date(moment(log.recv_by_oc).format()).valueOf();
          // let diff2 = findDiff(createdAt, receivedAt);
          // let msg7 = consoleDiff('Feed Creation', 'Received by online clustering', diff2);
          // let readAt = new Date(moment(log.read_in_spark).format()).valueOf();
          // let diff3 = findDiff(receivedAt, readAt);
          // let msg8 = consoleDiff('Received by online clustering', 'Read by Spark', diff3);
          // let diff4 = findDiff(readAt, writtenAt);
          // let msg9 = consoleDiff('Read by Spark', 'Written to MongoDB', diff4);
          let finalMsg = [msg1, msg6];
          callback(finalMsg.join('\n'));
        })
      });
    }
  })
};

function findDiff(d1, d2){
  let diff = d2 - d1;
  console.log('DIFF', diff);
  let hours = Math.floor(diff/(1000*60*60));
  let rest = diff % (1000*60*60);
  let minutes = Math.floor(rest/(60*1000));
  rest = diff % (60);
  let seconds = Math.floor(rest/1000);
  rest = rest % 1000;
  let milliseconds = rest;
  return { hours, minutes, seconds, milliseconds };
};

function consoleDiff(from, to, diff){
  return `_Time taken from ${from} till ${to}_: *${diff.hours}* hours, *${diff.minutes}* minutes, *${diff.seconds}* seconds`;
};

module.exports = {
  findData
};
