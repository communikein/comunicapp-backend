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
 * Gets the user profile for the user that calls the request.
 * This method MUST be called with GET method, and a JWT Auth token
 * is required.
 */
exports.user = functions.https.onRequest((req, res) => {
	//Only GET requests are allowed. Checking the HTTP method in the first stance
	if (req.method != 'GET') {
		console.error('Only GET requests are allowed');
		res.status(405).set('Allow', 'GET')
			.json({message: 'Only GET requests are allowed'});
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
					//User found in DB, writing the user in the response
					querySnapshot.forEach(userSnapshot => {
						res.status(200).json({
							email : userSnapshot.get('email'),
							name : userSnapshot.get('name'),
							role : userSnapshot.get('role'),
							uid : userSnapshot.get('uid')
						});
						return;
					});
				} else {
					//User not found in DB
					res.status(404).json({message: 'Not found'});
					return;
				}
			});
		})
		.catch(error => {
			console.error('Error while verifying Firebase ID token:', error);
			res.status(403).json({message: 'Unauthorized'});
		});
});
