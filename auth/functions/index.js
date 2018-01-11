const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);

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
exports.storeUserInDB = functions.auth.user().onCreate(event => {
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


/* 
 * @author: Gregorio Palamà
 * 
 * Gets or updates the user profile for the user that calls the request.
 * This method MUST be called with GET or POST method, and a JWT Auth token
 * is required.
 * The GET method is used to retrieve the profile. If the user is not found in the DB, 
 * it means the storeUserInDB function has not been called yet. The GET, then, returns
 * the profile by creating it the same way it will be created by storeUserInDB.
 * The POST method is used to update the profile. The only accepted fields
 * are image and name. Every other field will be ignored and not stored in the DB.
 */
exports.user = functions.https.onRequest((req, res) => {
  //Only GET requests are allowed. Checking the HTTP method in the first stance
  if (req.method != 'GET' && req.method != 'POST') {
    console.error('Only GET and POST requests are allowed');
    res.status(405).set('Allow', 'GET, POST')
      .json({message: 'Only GET and POST requests are allowed'});
    return;
  }

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

  admin
    .auth()
    .verifyIdToken(idToken) //Verifying the token
    .then(decodedUser => {
      //Token verified, reading the user from DB
      console.log('ID Token correctly decoded', decodedUser);
      const usersCollection = firestore.collection('users');

      let queryById = usersCollection.where('uid', '==', decodedUser.user_id);
      queryById.limit(1).get().then(querySnapshot => {
        if (!querySnapshot.empty) {
          //If the method is GET, the profile is returned
          if (req.method == 'GET') {
            //User found in DB, writing the user in the response
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
          }
          //If the method is POST, the profile is updated, then returned in response
          if (req.method == 'POST') {
            querySnapshot.forEach(userSnapshot => {
              //Only updating name and image
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
              //Finally, the updated profile is returned into the response
              res.status(200).json({
                email : userSnapshot.get('email'),
                name : tempName,
                role : userSnapshot.get('role'),
                image : tempImage,
                uid : userSnapshot.get('uid')
              });
              return;
            });
          }
        } else {
          //If the user is not yet in the DB, the profile is built from the 
          //Auth informations
          if (req.method == 'GET') {
            //User not found in DB
            res.status(200).json({
                email : decodedUser.email,
                name : decodedUser.name,
                role : defaultRole,
                image : decodedUser.picture,
                uid : decodedUser.user_id
              });
            return;
          }
          //If the user is not yet in the DB, it can't be updated
          if (req.method == 'POST') {
            res.status(404).json({message: 'Not found'});
            return;
          }
        }
      });
    })
    .catch(error => {
      console.error('Error while verifying Firebase ID token:', error);
      res.status(403).json({message: 'Unauthorized'});
    });
});
