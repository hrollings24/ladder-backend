const admin = require('firebase-admin');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const cors = require('cors')({origin: true});
const MethodException = require('../Global/MethodException.js')

module.exports.AcceptChallengeWithID = async function(challengeID) {
    const db = admin.firestore();

    //check correct user ID
    const challengeRef = db.collection('challenge').doc(challengeID);
    
    //get challenge data
    var challengeSnapshot = await challengeRef.get();
    if (!challengeSnapshot.exists)
    {
        throw new MethodExeption('not-found',  'The challenge could not be found')
    }

    //Change challenge status to ongoing
    challengeRef.update({
        "status": "ongoing"
    });

    //remove old notifications for this challenge
    let noteExisting = await db.collection('notifications').where('challengeRef', '==', challengeRef).get();
    if (!noteExisting.empty) {
        //notification exists
        noteExisting.forEach(note => {
            note.ref.delete();
        });
    }

    var challengeData = challengeSnapshot.data()
    //user1 is the user who has to be accepting
    //load user for notification
    var userRef = db.collection('users').doc(challengeData.user1)
    var userSnapshot = await userRef.get();
    let userData = userSnapshot.data()

    //send new notification to say challenge accepted
    const dataToSave = {
        "toUser": db.collection('users').doc(challengeData.user2),
        "message": userData.username + " has accepted your challenge in " + challengeData.ladderName,
        "ladder": db.collection('ladders').doc(challengeData.ladder),
        "type": "message",
        "title": "Challenge Accepted",
        "fromUser": db.collection('users').doc(challengeData.user1)
    };

    await db.collection('notifications').doc().set(dataToSave);

    return "";
}

module.exports.CreateChallenge = async function(userIdToChallenge, ladderId, userIdAskingForChallenge) {
    const db = admin.firestore();

    //check user and ladder exist
    const userRef = db.collection('users').doc(userIdToChallenge);
    //get challenge data
    var userSnapshot = await userRef.get();
    if (!userSnapshot.exists)
    {
        throw MethodException('not-found',  'The user to challenge could not be found')
    }

    //check user and ladder exist
    const authUserRef = db.collection('users').doc(userIdAskingForChallenge);
    //get challenge data
    var authUserSnapshot = await authUserRef.get();
    if (!authUserSnapshot.exists)
    {
        throw MethodException('not-found',  'The authorised user could not be found')
    }

    const ladderRef = db.collection('ladders').doc(ladderId);
    var ladderSnapshot = await ladderRef.get();
    if (!ladderSnapshot.exists)
    {
        throw new MethodException('not-found',  'The ladder could not be found')
    }

    //check if challenge already exists
    const challengeRef = db.collection('challenge');
    let challengeExisting = await challengeRef.where('user1', '==', userIdToChallenge).where('user2', '==', userIdAskingForChallenge).where('ladder', '==', ladderId).get();

    if (!challengeExisting.empty) {
        //Challenge already exists
        throw new MethodException('already-exists',  'The challenge already exists')
    }
    else{
        let challengeExisting2 = await challengeRef.where('user1', '==', userIdAskingForChallenge).where('user2', '==', userIdToChallenge).where('ladder', '==', ladderId).get();
        if (!challengeExisting2.empty) {
            //Challenge already exists
            throw new MethodException('already-exists',  'The challenge already exists')
        }
    }

    //check jump
    var positionsArray = ladderSnapshot.data().positions
    var userIdAskingForChallengePosition = positionsArray.indexOf(userIdAskingForChallenge)
    if (!userIdAskingForChallengePosition)
    {
        throw new MethodException('permission-denied',  'Authorised user is not in the ladder')
    }
    var userIdToChallengePos = positionsArray.indexOf(userIdToChallenge)
    if (userIdAskingForChallengePosition - userIdToChallengePos > ladderSnapshot.data().jump)
    {
        throw new MethodException('permission-denied',  'Challenge not allowed due to the ladders jump')
    }

    //Now all checks passed, create the challenge
    const dataToSave = {
        user1: userIdToChallenge, 
        user2: userIdAskingForChallenge,
        ladder: ladderId,
        ladderName: ladderSnapshot.data().name,
        status: "Awaiting Response",
        winner: "",
        winnerselectedby: ""
    };

    let challengeNewRef = db.collection('challenge').doc()
    await challengeNewRef.set(dataToSave);

    db.collection('users').doc(userIdToChallenge).update({
        challenges: FieldValue.arrayUnion(challengeNewRef)
    })

    db.collection('users').doc(userIdAskingForChallenge).update({
        challenges: FieldValue.arrayUnion(challengeNewRef)
    })    


    const dataToSaveForNotification = {
        toUser: userRef,
        ladder: ladderRef,
        message: authUserSnapshot.data().username + " has challenged you in " + ladderSnapshot.data().name,
        challengeRef: challengeNewRef,
        title: "New Challenge",
        fromUser: authUserRef,
        type: "challenge"
    };

    //go ahead with notificaton
    await db.collection('notifications').doc().set(dataToSaveForNotification);

    const dataToReturn = {
        ChallengeId: challengeNewRef.id,
    };
    return dataToReturn;
}

module.exports.DeclineChallengeWithIdFromUser = async function(challengeID, userIdRequestingDelete) {
    const db = admin.firestore();

    const challengeRef = db.collection('challenge').doc(challengeID);
    
    //get challenge data
    var challengeSnapshot = await challengeRef.get();

    if (!challengeSnapshot.exists)
    {
        throw new MethodExeption('not-found',  'The challenge could not be found')
    }

    const ladderRef = db.collection('ladders').doc(challengeSnapshot.data().ladder);
    var ladderSnapshot = await ladderRef.get();

    if (!ladderSnapshot.exists)
    {
        throw new MethodExeption('not-found',  'The ladder this challenge resides in could not be found')
    }

    var toUserRef;
    if (challengeSnapshot.data().user1 == userIdRequestingDelete)
    {
        toUserRef = db.collection('users').doc(challengeSnapshot.data().user2);
    }
    else
    {
        toUserRef = db.collection('users').doc(challengeSnapshot.data().user1);
    }

    var toUserSnapshot = await toUserRef.get();
    if (!toUserSnapshot.exists)
    {
        throw new MethodExeption('not-found',  'One of the users in the challenge could not be found')
    }

    return this.DeleteChallengeBySnapshot(challengeSnapshot, challengeRef).then((result) => {
        //send out notification

        //Create notification to inform the other player
        const dataToSaveForNotification = {
            toUser: toUserRef,
            ladder: ladderRef,
            message: "Your challenge with  " + toUserSnapshot.data().username + " in " + ladderSnapshot.data().name + " was declined",
            title: "Challenge Declined",
            fromUser: db.collection('users').doc(userIdRequestingDelete),
            type: "message"
        };
    
        //go ahead with notificaton
        db.collection('notifications').doc().set(dataToSaveForNotification);

        return;
    }).catch((ex) => {
        if (ex instanceof MethodException)
        {
            throw ex
        }
        throw new MethodException('internal',  ex)
    });   
}

module.exports.DeleteChallengeBySnapshot = async function(challengeSnapshot, challengeRef) {

    const db = admin.firestore();

    if (!challengeSnapshot.exists)
    {
        throw new MethodExeption('not-found',  'The challenge could not be found')
    }

    //delete all notifications to do with the challenge
    let notes = await db.collection('notifications').where('challengeRef', '==', challengeRef).get();
    if (!(notes.empty)) {
        notes.forEach(doc => {
            let noteRef = doc.ref;
            noteRef.delete();
        });
    }  

    //Remove the challenge from the users
    let user1ID = challengeSnapshot.data().user1
    let user2ID = challengeSnapshot.data().user2

    let user1Ref = db.collection('users').doc(user1ID);
    user1Ref.update({
        challenges: FieldValue.arrayRemove(challengeRef)
    });

    let user2Ref = db.collection('users').doc(user2ID);
    user2Ref.update({
        challenges: FieldValue.arrayRemove(challengeRef)
    });

    //finally delete the challenge document itself
    challengeRef.delete();
}

module.exports.AddWinnerToChallenge = async function(challengeId, winnerId, authedUser){
    const db = admin.firestore();

    const challengeRef = db.collection('challenge').doc(challengeId);

    //get challenge data
    var challengeSnapshot = await challengeRef.get();
    if (!challengeSnapshot.exists)
    {
        throw new MethodExeption('not-found',  'The challenge could not be found')
    }

    challengeRef.update({
        winnerselectedby: authedUser,
        winner: winnerId
    })

    var toUserRef;
    //find user to send note to
    if (challengeSnapshot.data().user1 == authedUser)
    {
        toUserRef = db.collection('users').doc(challengeSnapshot.data().user2)
    }
    else
    {
        toUserRef = db.collection('users').doc(challengeSnapshot.data().user1)
    }

    const inLadder = db.collection('ladders').doc(challengeSnapshot.data().ladder)

    const dataToSaveForNotification = {
        toUser: toUserRef,
        ladder: inLadder,
        message: "A winner has been selected for your challenge in " + challengeSnapshot.data().ladderName,
        challengeRef: challengeRef,
        title: "Winner Selected",
        fromUser: db.collection('users').doc(authedUser),
        type: "challengeSelected"
    };
      
    //go ahead with notificaton
    await db.collection('notifications').doc().set(dataToSaveForNotification);

    return "";
}

module.exports.ConfirmChallenge = async function(challengeId, authedUser){
    const db = admin.firestore();

    //delete challenge & send out notifications
    //check correct user ID
    const challengeRef = db.collection('challenge').doc(challengeId);

    //get challenge data
    var challengeSnapshot = await challengeRef.get();
    if (!challengeSnapshot.exists)
    {
        throw new MethodExeption('not-found',  'The challenge could not be found')
    }

    var toUserRef;
    //find user to send note to
    if (challengeSnapshot.data().user1 == authedUser)
    {
        toUserRef = db.collection('users').doc(challengeSnapshot.data().user2)
    }
    else
    {
        toUserRef = db.collection('users').doc(challengeSnapshot.data().user1)
    }

    const ladderRef = db.collection('ladders').doc(challengeSnapshot.data().ladder);
    //get challenge data
    var ladderSnapshot = await ladderRef.get();
    if (!ladderSnapshot.exists)
    {
        throw new MethodExeption('not-found',  'The ladder could not be found')
    }

    var loserRef;
    //find user to send note to
    if (challengeSnapshot.data().user1 == challengeSnapshot.data().winner)
    {
        loserRef = db.collection('users').doc(challengeSnapshot.data().user2)
    }
    else
    {
        loserRef = db.collection('users').doc(challengeSnapshot.data().user1)
    }

    var positions = ladderSnapshot.data().positions

    var winnerPos = positions.indexOf(challengeSnapshot.data().winner);
    var loserPos = positions.indexOf(loserRef.id);


    if (winnerPos > loserPos)
    {
        if (winnerPos > -1) {
            positions.splice(winnerPos, 1); // 2nd parameter means remove one item only
        }
        if (loserPos > -1) {
            positions.splice(loserPos, 1); // 2nd parameter means remove one item only
        }
        positions.splice(loserPos, 0, challengeSnapshot.data().winner);
        positions.splice(loserPos+1, 0, loserRef.id);

        ladderRef.update({
            positions: positions
        });
    }

    return this.DeleteChallengeBySnapshot(challengeSnapshot, challengeRef).then((result) => {
        //send out notification

        //Create notification to inform the other player
        const dataToSaveForNotification = {
            toUser: toUserRef,
            ladder: ladderRef,
            message: "Your challenge in " + challengeSnapshot.data().ladderName + " was completed",
            title: "Challenge Complete",
            fromUser: db.collection('users').doc(authedUser),
            type: "message"
        };
    
        //go ahead with notificaton
        db.collection('notifications').doc().set(dataToSaveForNotification);

        return;
    }).catch((ex) => {
        if (ex instanceof MethodException)
        {
            throw ex
        }
        throw new MethodException('internal',  ex)
    });   

}

module.exports.DeclineWinner = async function(challengeId, authedUser){
    const db = admin.firestore();

    //delete challenge & send out notifications
    //check correct user ID
    const challengeRef = db.collection('challenge').doc(challengeId);

    //get challenge data
    var challengeSnapshot = await challengeRef.get();
    if (!challengeSnapshot.exists)
    {
        throw new MethodExeption('not-found',  'The challenge could not be found')
    }

    var toUserRef;
    //find user to send note to
    if (challengeSnapshot.data().user1 == authedUser)
    {
        toUserRef = db.collection('users').doc(challengeSnapshot.data().user2)
    }
    else
    {
        toUserRef = db.collection('users').doc(challengeSnapshot.data().user1)
    }

    const ladderRef = db.collection('ladders').doc(challengeSnapshot.data().ladder);

    challengeRef.update({
        winnerselectedby: "",
        winner: ""
    })

    //Create notification to inform the other player
    const dataToSaveForNotification = {
        toUser: toUserRef,
        ladder: ladderRef,
        message: "The winner for your challenge in " + challengeSnapshot.data().ladderName + " was declined",
        title: "Winner Declined",
        fromUser: db.collection('users').doc(authedUser),
        type: "message"
    };

    //go ahead with notificaton
    db.collection('notifications').doc().set(dataToSaveForNotification);  

}
