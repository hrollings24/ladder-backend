const functions = require('firebase-functions');
const admin = require('firebase-admin');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const challengeFunc = require('./challengeFunctions');



//WITHDRAW USER FROM LADDER
exports.withdrawUserFromLadder = functions.https.onCall(async (data,context) => {

    const db = admin.firestore();

    await findAndDeleteChallengesFor(data.userID, data.ladderID);

    const userRef = db.collection('users').doc(data.userID);
    const ladderRef = db.collection('ladders').doc(data.ladderID);

    //CHECK IS USER IS AN ADMIN BEFORE REMOVING THE LADDER FROM THEIR ACCOUNT
    if (!data.isAdmin){
        await userRef.update({
            ladders: FieldValue.arrayRemove(ladderRef)
        });
    }

    await ladderRef.update({
        positions: FieldValue.arrayRemove(data.userID)
    });


    return "Successfully removed from ladder"

})

//USED TO DELETE CHALLENGES WHEN A USER WITHDRAWS FROM LADDER 
async function findAndDeleteChallengesFor(userID, ladderID) {
    const db = admin.firestore();

    const challengeCollection = db.collection('challenge');
    

    const challengesToDelete = await challengeCollection.where('user1', '==', userID).where('ladder', '==', ladderID).get();
    challengesToDelete.forEach(function(challenge) {
        console.log(challenge.uid)
        deleteChallengeWith(challenge.ref.id)
    });

    const challengesToDelete2 = await challengeCollection.where('user2', '==', userID).where('ladder', '==', ladderID).get();
    challengesToDelete2.forEach(function(challenge) {
        console.log(challenge.uid)
        deleteChallengeWith(challenge.ref.id)
    });

    //find notifications linking to the challenge

    
   
}

//SEND REQUEST TO JOIN A LADDER
exports.requestToJoinALadder = functions.https.onCall(async (data,context) => {
    //check if ladder is open, no requests
    const db = admin.firestore();

    const ladderRef = db.collection('ladders').doc(data.ladderID);

    let ladderSnp = await ladderRef.get();

    if (ladderSnp.exists) {
        let docData = ladderSnp.data()
        let permissions = docData.permission;
        if (permissions == "Public, with Requests"){
            //check if request already exists
            let requests = docData.requests;
            if (requests.includes(data.userID)){
                const dataToReturn = {
                    title: "Request Already Sent",
                    message: "You have already requested to join this ladder"
                };
                return dataToReturn;
            }
            


            //SEND A REQUEST
            ladderRef.update({
                requests: FieldValue.arrayUnion(data.userID)
            });
            let admins = docData.admins;
            admins.forEach(function(ladderAdmin) {
                //Send notification to admin that a request has been recieved
                sendNotificationToAdmin(ladderAdmin, data.ladderID, data.userID)
                
                
            });

            const dataToReturn = {
                title: "Request Sent",
                message: "Your request to join the ladder will be reviewed by an admin"
            };
            return dataToReturn;

        }
        else{
            //ADD USER TO LADDER
            addUserToLadder(data.ladderID, data.userID)
            const dataToReturn = {
                title: "Added",
                message: "You have successfully been added to the ladder"
                };
            return dataToReturn;
        }
    } 
})

async function sendNotificationToAdmin(ladderAdmin, ladderID, userID){
    const db = admin.firestore();

    let toUser = db.collection('users').doc(ladderAdmin)
    const inLadder = db.collection('ladders').doc(ladderID);
    const fromUserRef = db.collection('users').doc(userID);
    let userSnp = await fromUserRef.get();
    if (userSnp.exists) {
        let fromUserData = userSnp.data()
        let username = fromUserData.username;

        const dataToSave = {
            toUser: toUser,
            ladder: inLadder,
            message: username + " has requested to join the ladder",
            title: "Request Received",
            fromUser: fromUserRef,
            type: "request"
        };
        await db.collection('notifications').doc().set(dataToSave);

    }

    return "Completed"

}

//ADD A USER TO A LADDER
function addUserToLadder(withaLadderID, forUserID){
    const db = admin.firestore();

    const ladderRef = db.collection('ladders').doc(withaLadderID);
    const userRef = db.collection('users').doc(forUserID);

    ladderRef.update({
        "positions": FieldValue.arrayUnion(forUserID)
    });

    userRef.update({
        "ladders": FieldValue.arrayUnion(ladderRef)
    });

}

exports.acceptRequest = functions.https.onCall(async (data,context) => {
    //data = [toUserID: String, ladderID: String, fromUser: String, message: String]
    const db = admin.firestore();

    const toUser = db.collection('users').doc(data.toUserID);

    //REMOVE THE REQUEST FROM ARRAY IN LADDER
    const ladderRef = db.collection('ladders').doc(data.ladderID);
    ladderRef.update({
        requests: FieldValue.arrayRemove(data.toUserID)
    });

    const inLadder = db.collection('ladders').doc(data.ladderID);

    //delete old notification
    let oldNote = await db.collection('notifications').where('ladder', '==', ladderRef).where('fromUser', '==', toUser).get();
    oldNote.forEach(function(note) {
        note.ref.delete();
    });

    //Create notification for request acceptance
    const dataToSave = {
        toUser: toUser,
        ladder: inLadder,
        message: data.message,
        title: "Request Accepted",
        fromUser: db.collection('users').doc(data.fromUser),
        type: "message"
    };

    await db.collection('notifications').doc().set(dataToSave);

    //ADD USER TO THE LADDER
    addUserToLadder(data.ladderID, data.toUserID)
    
    const dataToReturn = {
        title: "Added",
        message: "You have successfully added the user to the ladder"
        };
    return dataToReturn;

})

//DELETE A USER FROM AN ADMIN
exports.deleteUserFromAdmin = functions.https.onCall(async (data,context) => {
    //data = [userIDToDelete: String, ladderID: String, message: String, fromUser: String, type: String, isAdmin: Bool]
    const db = admin.firestore();

    findAndDeleteChallengesFor(data.userIDToDelete, data.ladderID);

    const userRef = db.collection('users').doc(data.userIDToDelete);
    const ladderRef = db.collection('ladders').doc(data.ladderID);

    //CHECK IF USER IS AN ADMIN BEFORE REMOVING FROM THEIR ACCOUNT
    if (!data.isAdmin){
        userRef.update({
            ladders: FieldValue.arrayRemove(ladderRef)
        });
    }
    
    

    ladderRef.update({
        positions: FieldValue.arrayRemove(data.userIDToDelete)
    });

    //send notification to user

    const dataToSave = {
        toUser: userRef,
        ladder: ladderRef,
        message: data.message,
        title: "Removed from Ladder",
        fromUser: db.collection('users').doc(data.fromUser),
        type: data.type
    };
    
    //go ahead with notificaton
    await db.collection('notifications').doc().set(dataToSave);
    const dataToReturn = {
        title: "Removed",
        message: "The user was successfully removed from the ladder"
    };
    return dataToReturn;


})

//DELETE AN ADMIN
exports.deleteLadder = functions.https.onCall(async (data,context) => {
    //data = [ladderID: String]
    
    return deleteLadderNow(data.ladderID)
    
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

exports.rejectAdminInvite = functions.https.onCall(async (data,context) => {
    //data = [oldNoteID: String, oldnoteToUser: String, oldNoteFromUser: String, ladderRef: String, username: String]
    const db = admin.firestore();

    //remove old notification
    const oldNote = db.collection('notifications').doc(data.oldNoteID);
    await oldNote.delete();

    const toUser = db.collection('users').doc(data.oldnoteToUser);
    const fromUser = db.collection('users').doc(data.oldNoteFromUser);
    const mess = "Your admin invite was rejected by " + data.username

    //send new one saying person reject admin invite
    const dataToSave = {
        toUser: fromUser,
        ladder: data.ladderRef,
        message: mess,
        title: "Admin Invitation Denied",
        fromUser: toUser,
        type: "message"
    };

    await db.collection('notifications').doc().set(dataToSave);

    const dataToReturn = {
        title: "Success",
        message: "The invite was rejected."
    };
    return dataToReturn;

})

exports.rejectNormalInvite = functions.https.onCall(async (data,context) => {
    //data = [oldNoteID: String, oldnoteToUser: String, oldNoteFromUser: String, ladderRef: String, username: String]
    const db = admin.firestore();

    //remove old notification
    const oldNote = db.collection('notifications').doc(data.oldNoteID);
    await oldNote.delete();

    const toUser = db.collection('users').doc(data.oldnoteToUser);
    const fromUser = db.collection('users').doc(data.oldNoteFromUser);
    const mess = "Your invitation was rejected by " + data.username

    //send new one saying person reject admin invite
    const dataToSave = {
        toUser: fromUser,
        ladder: data.ladderRef,
        message: mess,
        title: "Invitation Denied",
        fromUser: toUser,
        type: "message"
    };

    await db.collection('notifications').doc().set(dataToSave);

    const dataToReturn = {
        title: "Success",
        message: "The invite was rejected."
    };
    return dataToReturn;

})


exports.checkName = functions.https.onCall(async (data,context) => {

    const db = admin.firestore();
    const userCollection = db.collection('ladders');
    let usersInTheLadder = await userCollection.where('name', '==', data.name).get();

    if ((usersInTheLadder.empty)) {
        return true;
    }  
    else{
        return false;
    }
    
})


exports.createLadder = functions.https.onCall(async (data,context) => {
    //data = [permission, name, requests, jump, includeMe, description, currentUserId]
    
    var currentUserId = data.currentUserId
    const ladderURL = data.name.replace(/\s/g,'')
    const adminIDs = [currentUserId]
    var positions = []

    try{
        //Check if ladder exists
        const db = admin.firestore();

        const challengeRef = db.collection('ladders');
        let ladderExisting = await challengeRef.where('url', '==', ladderURL).get();

        if (!ladderExisting.empty) {
            //Challenge already exists
            throw "A ladder already exists with this name"
        }

        if (data.includeMe){
            positions[0] = currentUserId
        }

        //If ladder does not exist, create the ladder
        const dataToSave = {
            permission: data.permission, 
            name: data.name,
            admins: adminIDs,
            requests: data.requests,
            jump: data.jump,
            positions: positions,
            description: data.description,
            url: ladderURL
        };

        console.log(dataToSave)

        let ladderNewRef = db.collection('ladders').doc()
        await ladderNewRef.set(dataToSave);

        db.collection('users').doc(data.currentUserId).update({
            ladders: FieldValue.arrayUnion(ladderNewRef)
        })
        const dataToReturn = {
            title: "Success",
            message: "Ladder successfully created",
            ladderRef: ladderNewRef
        };
        return dataToReturn;
    }
    catch (ex){
        const dataToReturn = {
            title: "Error",
            message: ex.message
        };
        return dataToReturn;
    }
})
