const functions = require('firebase-functions');
const admin = require('firebase-admin');
const FieldValue = require('firebase-admin').firestore.FieldValue;

exports.saveAccountChanges = functions.https.onCall(async (data,context) => {

    if (data.userID == null){
        throw 'User ID is null'
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(data.userID);

    if (data.username != null){
        //save username
        userRef.update({
            username: data.username
        })
    }

    if (data.picture != null){
        //save picture
        userRef.update({
            picture: data.picture
        })
    }

})