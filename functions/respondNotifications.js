const functions = require('firebase-functions');
const admin = require('firebase-admin');
const FieldValue = require('firebase-admin').firestore.FieldValue;

//ACCEPT AN ADMIN INVITATION
exports.acceptAdminInvite = functions.https.onCall(async (data,context) => {
    const db = admin.firestore();

    //check is user is in ladder - if not, add the ladder to the USERS document, not the other way round
    let userRef = db.collection('users').doc(data.fromUserID);
    let userSnp = await userRef.get();
    let ladderRef = db.collection('ladders').doc(data.ladderID);

    if (!userSnp.exists) {
        console.log('No such document!');
      } else {
          let docData = userSnp.data()
          let usersladders = docData.ladders;
          console.log(usersladders);
          var alreadyInLadder = usersladders.includes(ladderRef);
          if (!alreadyInLadder){
              //add to ladder
              userRef.update({
                "ladders": FieldValue.arrayUnion(ladderRef)
              });
          }
      }
    

    //add admin in the ladder document
    ladderRef.update({
        "admins": FieldValue.arrayUnion(data.fromUserID)
    });

    //remove old notification
    const res = await db.collection('notifications').doc(data.notificationID).delete();

    let sendingToUser = db.collection('users').doc(data.toUserID);

    //create new notification to say 'user has accepted admin invite'        
    const dataToSave = {
        "toUser": sendingToUser,
        "message": data.username + " has accepted your admin request",
        "ladder": ladderRef,
        "type": "message",
        "title": "New Admin Added",
        "fromUser": userRef
    };
    await db.collection('notifications').doc().set(dataToSave);
    return "Successfully added as admin";


})

//ACCEPT CHALLENGE
exports.acceptChallengeOld = functions.https.onCall(async (data,context) => {
    const db = admin.firestore();

    //Change challenge status to ongoing
    const challengeCollectionRef = db.collection('challenge');
    let challengeExisting = await challengeCollectionRef.where('user1', '==', data.toUser).where('user2', '==', data.fromUser).where('ladder', '==', data.ladderID).get();
    var challengeRef;

    if (!challengeExisting.empty) {
        //Challenge exists
        challengeExisting.forEach(challenge => {
            let challengeID = challenge.id
            challengeRef = challengeCollectionRef.doc(challengeID);
        });
    }
    else{
        let challengeExisting2 = await challengeCollectionRef.where('user1', '==', data.fromUser).where('user2', '==', data.toUser).where('ladder', '==', data.ladderID).get();
        if (!challengeExisting2.empty) {
            //Challenge exists
            challengeExisting2.forEach(challenge => {
                let challengeID = challenge.id
                challengeRef = challengeCollectionRef.doc(challengeID);
            });
        }
    }  

    challengeRef.update({
        "status": "ongoing"
    });

    let noteExisting = await db.collection('notifications').where('challengeRef', '==', challengeCollectionRef.doc(data.challengeID)).get();
    if (!noteExisting.empty) {
        //note exists
        noteExisting.forEach(note => {
            note.ref.delete();
        });
    }

    //send notification to say challenge accepted
    const dataToSave = {
        "toUser": db.collection('users').doc(data.toUser),
        "message": data.message,
        "ladder": db.collection('ladders').doc(data.ladderID),
        "type": "message",
        "title": "Challenge Accepted",
        "fromUser": db.collection('users').doc(data.fromUser)
    };

    await db.collection('notifications').doc().set(dataToSave);
    
    const dataToReturn = {
        title: "Success",
        message: "The challenge has been accepted"
    };
    return dataToReturn;

})