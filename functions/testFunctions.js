const functions = require('firebase-functions');

//Return error
exports.returnAnError = functions.https.onCall(async (data,context) => {

    throw new functions.https.HttpsError('unknown', "Let's throw an error" )
})