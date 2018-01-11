const functions = require('firebase-functions');
const admin = require('firebase-admin');

try {admin.initializeApp(functions.config().firebase);} catch(e) {}

const firestore = admin.firestore();
const usersCollection = firestore.collection('users');

const defaultRole = 1;

/* 
 * @author: Gregorio Palamà
 * 
 * Reads a newly created user and stores it in the Firestore DB
 * If the user is already in the DB, it only updates the uid inside the user document
 * It never updates the document's ID.
 */
exports = module.exports = functions.auth.user().onCreate(event => {
  const user = event.data;

  const dbUser = {
    uid : user.uid,
    name : user.displayName,
    email : user.email,
    image : user.photoURL,
    role : defaultRole
  };

  let queryById = usersCollection.where('uid', '==', user.uid);
  queryById.limit(1).get().then(querySnapshot => {
    if (!querySnapshot.empty) {
      querySnapshot.forEach(documentSnapshot => {
        console.log('User already in DB with ID: ${documentSnapshot.ref.id}');
      });
    } else {
      let queryByMail = usersCollection.where('email', '==', user.email);
      queryByMail.limit(1).get().then(querySnapshot => {
        if (!querySnapshot.empty) {
          querySnapshot.forEach(documentSnapshot => {
            usersCollection.doc(documentSnapshot.ref.id).update({
              uid : user.uid
            }).then(res => {
              console.log('User already in DB with ID: ${documentSnapshot.ref.id}, but uid was updated');
            });
          });
        } else {
          usersCollection.doc(user.uid).set(dbUser).then(res => {
            console.log('Added user at time ${res.writeTime}');
          });
        }
      });
    }
  });

  return 0;
});

