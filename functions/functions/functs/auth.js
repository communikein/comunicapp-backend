/* 
 * @author: Gregorio Palamà
 * 
 * Gets or updates the user profile for the user that calls the request.
 * This method MUST be called with GET or POST method, and a JWT Auth token
 * is required.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

try {admin.initializeApp(functions.config().firebase);} catch(e) {}

const firestore = admin.firestore();
const usersCollection = firestore.collection('users');

const defaultRole = 1;
const express = require('express');
const app = express();

const validateFirebaseIdToken = (req, res, next) => {
  //The request MUST be done with a JWT Auth token. 
  //Checking if the request has the token
  if (!req.headers.authorization
      || !req.headers.authorization.startsWith('Bearer ')) {
    console.error('No Firebase ID token was passed as a Bearer token in the Authorization header');
    res.status(403).json({message: 'Unauthorized'});
    return;
  }

  //Reading the token
  let idToken;
  if (req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')) {
    console.log('Found "Authorization" header');
    idToken = req.headers.authorization.split('Bearer ')[1];
  }

  admin.auth().verifyIdToken(idToken).then(decodedIdToken => {
    console.log('ID Token correctly decoded', decodedIdToken);
    req.user = decodedIdToken;
    next();
  }).catch(error => {
    console.error('Error while verifying Firebase ID token:', error);
    res.status(403).json({message: 'Unauthorized'});
  });
};

app.use(validateFirebaseIdToken);

app.get('/v1/user', (req, res) => {
  const usersCollection = firestore.collection('users');
  let queryById = usersCollection.where('uid', '==', req.user.user_id);
  queryById.limit(1).get().then(querySnapshot => {
    if (!querySnapshot.empty) {
      querySnapshot.forEach(userSnapshot => {
        res.status(200).json({
          email : userSnapshot.get('email'),
          name : userSnapshot.get('name'),
          role : userSnapshot.get('role'),
          image : userSnapshot.get('image'),
          uid : userSnapshot.get('uid')
        });
        return;
      });
    } else {
      //User not found in DB
      res.status(200).json({
          email : req.user.email,
          name : req.user.name,
          role : defaultRole,
          image : req.user.picture,
          uid : req.user.user_id
        });
      return;
    }
  });
});


app.post('/v1/user', (req, res) => {
  const usersCollection = firestore.collection('users');

  let queryById = usersCollection.where('uid', '==', req.user.user_id);
  queryById.limit(1).get().then(querySnapshot => {
    if (!querySnapshot.empty) {
      querySnapshot.forEach(userSnapshot => {
        var tempName = userSnapshot.get('name');
        if (req.body.name != null) {
          usersCollection.doc(userSnapshot.ref.id).update({
            name : req.body.name
          }).then(res => {
            console.log('User name updated');
          });
          tempName = req.body.name;
        }
        var tempImage = userSnapshot.get('image');
        if (req.body.image != null) {
          usersCollection.doc(userSnapshot.ref.id).update({
            name : req.body.image
          }).then(res => {
            console.log('User image updated');
          });
          tempImage = req.body.image;
        }
        res.status(200).json({
          email : userSnapshot.get('email'),
          name : tempName,
          role : userSnapshot.get('role'),
          image : tempImage,
          uid : userSnapshot.get('uid')
        });
        return;
      });
    } else {
      res.status(404).json({message: 'Not found'});
      return;
    }
  });
});

// Expose Express API as a single Cloud Function:
exports = module.exports = functions.https.onRequest(app);

