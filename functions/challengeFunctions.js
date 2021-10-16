const functions = require('firebase-functions');
const admin = require('firebase-admin');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const cors = require('cors')({origin: true});


//DELETES A CHALLENGE
exports.deleteChallenge = functions.https.onCall(async (challengeID,context) => {

    console.log(challengeID);
    return deleteChallengeWith(challengeID);

})

async function deleteChallengeWith(id){
    const db = admin.firestore();

    const challengeRef2 = db.collection('challenge').doc(id);

    let notes = await db.collection('notifications').where('challengeRef', '==', challengeRef2).get();
    if (!(notes.empty)) {
        notes.forEach(doc => {
            let noteRef = doc.ref;
            noteRef.delete();
        });
    }  


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

//CREATE A CHALLENGE
exports.createChallenge = functions.https.onCall(async (data,context) => {

    //data = [toUser, fromUser, ladderID, message, ladderName]

    //Check if challenge exists
    const db = admin.firestore();

    const challengeRef = db.collection('challenge');
    let challengeExisting = await challengeRef.where('user1', '==', data.toUser).where('user2', '==', data.fromUser).where('ladder', '==', data.ladderID).get();

    if (!challengeExisting.empty) {
        //Challenge already exists
        const dataToReturn = {
            title: "Error",
            message: "You have already challenged this user"
        };
        return dataToReturn;
    }
    else{
        let challengeExisting2 = await challengeRef.where('user1', '==', data.fromUser).where('user2', '==', data.toUser).where('ladder', '==', data.ladderID).get();
        if (!challengeExisting2.empty) {
            //Challenge already exists
            const dataToReturn = {
                title: "Error",
                message: "You have already challenged this user"
            };
            return dataToReturn;
        }
    }

    //If challenge does not exist, create the challenge
    const dataToSave = {
        user1: data.toUser, 
        user2: data.fromUser,
        ladder: data.ladderID,
        ladderName: data.ladderName,
        status: "Awaiting Response",
        winner: "",
        winnerselectedby: ""
    };

    let challengeNewRef = db.collection('challenge').doc()
    await challengeNewRef.set(dataToSave);

    db.collection('users').doc(data.toUser).update({
        challenges: FieldValue.arrayUnion(challengeNewRef)
    })

    db.collection('users').doc(data.fromUser).update({
        challenges: FieldValue.arrayUnion(challengeNewRef)
    })

    const toUserRef = db.collection('users').doc(data.toUser);
    const inLadder = db.collection('ladders').doc(data.ladderID);

    const dataToSaveForNotification = {
        toUser: toUserRef,
        ladder: inLadder,
        message: data.message,
        challengeRef: challengeNewRef,
        title: "New Challenge",
        fromUser: db.collection('users').doc(data.fromUser),
        type: "challenge"
    };
      
    

    //go ahead with notificaton
    await db.collection('notifications').doc().set(dataToSaveForNotification);


    const dataToReturn = {
        title: "Challenge Sent",
        message: "Your challenge has been sent"
    };
    return dataToReturn;
})

exports.addWinnerToChallenge = functions.https.onCall(async (data,context) => {
    //data = [toUser, fromUser, ladderID, message, challengeID, winnerID]

    const db = admin.firestore();

    const challengeRef = db.collection('challenge').doc(data.challengeID);
    challengeRef.update({
        winnerselectedby: data.fromUser,
        winner: data.winnerID
    })

    const toUserRef = db.collection('users').doc(data.toUser)
    const inLadder = db.collection('ladders').doc(data.ladderID)


    const dataToSaveForNotification = {
        toUser: toUserRef,
        ladder: inLadder,
        message: data.message,
        challengeRef: challengeRef,
        title: "Winner Selected",
        fromUser: db.collection('users').doc(data.fromUser),
        type: "challengeSelected"
    };
      
    

    //go ahead with notificaton
    await db.collection('notifications').doc().set(dataToSaveForNotification);


    const dataToReturn = {
        title: "Winner Selected",
        message: "Your winner has been added. Awaiting acceptance from other user."
    };
    return dataToReturn;

})



exports.declineChallenge = functions.https.onCall(async (data,context) => {
    //data = [toUserID, message, fromUserID, ladderID, challengeID]
    
    //delete challenge
    await deleteChallengeWith(data.challengeID)


    const db = admin.firestore();
    const toUserRef = db.collection('users').doc(data.toUserID);
    const ladderRef = db.collection('ladders').doc(data.ladderID);

    //Create notification to inform the other player
    const dataToSaveForNotification = {
        toUser: toUserRef,
        ladder: ladderRef,
        message: data.message,
        title: "Challenge Declined",
        fromUser: db.collection('users').doc(data.fromUserID),
        type: "message"
    };

    //go ahead with notificaton
    await db.collection('notifications').doc().set(dataToSaveForNotification);

    const dataToReturn = {
        title: "Success",
        message: "The challenge was declined"
    };
    return dataToReturn;

})