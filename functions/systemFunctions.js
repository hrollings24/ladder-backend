const functions = require('firebase-functions');
const admin = require('firebase-admin');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const ladderFunctions = require('./ladderFunctions');
const challengeFunc = require('./challengeFunctions');


exports.sendNotificationToFCMToken = functions.firestore.document('notifications/{mUID}').onWrite(async (event) => {
    
    let userRef = event.after.get('toUser');
    const userSnp = await userRef.get();

    var fcmTokens;
    if (userSnp.exists) {
        let docData = userSnp.data()
        console.log(docData.fcm);
        fcmTokens = docData.fcm;
    }
    else{
        console.log('No such document')
    }
    let noteType = event.after.get('type');
    
    let messageText = event.after.get('message')
    let title = event.after.get('title')
    let ladderRef = event.after.get('ladder')


    fcmTokens.forEach(function(tokenfcm) {
        var message = {
            notification: {
                title: title,
                body: messageText,
            },
            data:{
                type: noteType,
                ladder: ladderRef.id
            },
            token: tokenfcm,
            
        }
    
        admin.messaging().send(message);
    }); 

});

function getFCMToken(docRef) {
    return docRef.get().then(function (doc) {
        if (doc.exists) return doc.data().fcm;
        return Promise.reject("No such document");
    });
}

exports.checkUsername = functions.https.onCall(async (data,context) => {

    const db = admin.firestore();
    const userCollection = db.collection('users');
    let usersInTheLadder = await userCollection.where('username', '==', data.username).get();

    if ((usersInTheLadder.empty)) {
        return true;
    }  
    else{
        return false;
    }
    
})

exports.deleteUser = functions.https.onCall(async (data,context) => {
    //data = [userID: String]
    const db = admin.firestore();
    const userCollection = db.collection('users');
    let userToDelete = userCollection.doc(data.userID);


     //delete ladder if they are the only admin in a ladder
     let adminsTheUserIsPartOf = await db.collection('ladders').where('admins', 'array-contains', data.userID).get();
     if (!(adminsTheUserIsPartOf.empty)) {
         adminsTheUserIsPartOf.forEach(doc => {
             //doc is a ladder the user is an admin of
             let docData = doc.data()
             if (docData.admins.length == 1){
                 //DELETE LADDER
                 deleteLadderNow(doc.id);
             }
         });
     }  

     
    //remove user from all their ladders (positions)
    let laddersTheUserIsIn = await db.collection('ladders').where('positions', 'array-contains', data.userID).get();
    if (!(laddersTheUserIsIn.empty)) {
        laddersTheUserIsIn.forEach(doc => {
            doc.ref.update({
                positions: FieldValue.arrayRemove(data.userID)
            });
        });
    }  

    //delete any challenges the user is envolved in
    let user = await userToDelete.get();
    let userData = user.data()
    let usersChallenges = userData.challenges
    usersChallenges.forEach(doc => {
        //doc is a challenge that needs deleting
        deleteChallengeWith(doc.id)

    });


    userToDelete.delete();
    return "true";

})

async function deleteLadderNow(ladderID){
    const db = admin.firestore();
    const ladderRef = db.collection('ladders').doc(ladderID);
    const userCollection = db.collection('users');


    let usersInTheLadder = await userCollection.where('ladders', 'array-contains', ladderRef).get();

    if (!(usersInTheLadder.empty)) {
        usersInTheLadder.forEach(doc => {
            doc.ref.update({
                ladders: FieldValue.arrayRemove(ladderRef)
            });
        });
    }  


    let challengesInLadder = await db.collection('challenge').where('ladder', '==', ladderID).get();
    if (!(challengesInLadder.empty)) {
        challengesInLadder.forEach(doc => {
            let challengeID = doc.ref.id;
            deleteChallengeWith(challengeID);
        });
    }  

    let notes = await db.collection('notifications').where('ladder', '==', ladderRef).get();
    if (!(notes.empty)) {
        notes.forEach(doc => {
            let noteRef = doc.ref;
            noteRef.delete();
        });
    }  


    await ladderRef.delete();
    const dataToReturn = {
        title: "Success",
        message: "The ladder was deleted."
    };
    return dataToReturn;
}

exports.rejectRequest = functions.https.onCall(async (data,context) => {
    //data = [requestUserID: String, ladderID: String, message: String, fromUser: String]

    //delete request
    const db = admin.firestore();
    const ladderRef = db.collection('ladders').doc(data.ladderID);
    ladderRef.update({
        requests: FieldValue.arrayRemove(data.requestUserID)
    });



    const toUser = db.collection('users').doc(data.requestUserID);

      //delete old notification
      let oldNote = await db.collection('notifications').where('ladder', '==', ladderRef).where('fromUser', '==', toUser).get();
      oldNote.forEach(function(note) {
          note.ref.delete();
      });

    //send notification to user that request was deleted
    //Create notification for request acceptance
    const dataToSave = {
        toUser: toUser,
        ladder: ladderRef,
        message: data.message,
        title: "Request Denied",
        fromUser: db.collection('users').doc(data.fromUser),
        type: "message"
    };

    await db.collection('notifications').doc().set(dataToSave);

    const dataToReturn = {
        title: "Request Rejected",
        message: "The request was removed."
    };
    return dataToReturn;

})

async function deleteChallengeWith(id){
    const db = admin.firestore();

    const challengeRef2 = db.collection('challenge').doc(id);

    let challenge = await challengeRef2.get();
    let user1ID = challenge.data().user1
    let user2ID = challenge.data().user2

    let user1Ref = db.collection('users').doc(user1ID);
    user1Ref.update({
        challenges: FieldValue.arrayRemove(challengeRef2)
    });

    let user2Ref = db.collection('users').doc(user2ID);
    user2Ref.update({
        challenges: FieldValue.arrayRemove(challengeRef2)
    });

    const res = challengeRef2.delete();
    const dataToReturn = {
        title: "Success",
        message: "The ladder challenge was deleted"
    };
    return dataToReturn;
}