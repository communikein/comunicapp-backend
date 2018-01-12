/* 
 * @author: Gregorio Palamà
 * 
 * Notifies users for newly created News
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const moment = require('moment');

try {admin.initializeApp(functions.config().firebase);} catch(e) {}

const firestore = admin.firestore();
const topic = "news";

exports = module.exports = functions.firestore
  .document('news/{newsId}')
  .onCreate(event => {
    var newsValue = event.data.data();
    var date = moment().format();

    try {date = moment(newsValue.timestamp).format();} catch(e) {} 

    var payload = {
      data: {
        title : newsValue.title,
        timestamp : date,
        id : event.params.newsId
      }
    };

    admin.messaging().sendToTopic(topic, payload)
      .then(function(response) {})
      .catch(function(error) {
        console.log("Error sending message for topic news:", error);
      });
    return 0;
});

