const functions = require('firebase-functions');
const challengeMethods = require('../challenge-methods/challenge-methods');
const admin = require('firebase-admin');
const MethodException = require('../Global/MethodException.js')

//[userIdToChallenge, ladderId]
exports.createChallenge = functions.https.onCall(async (data,context) => {

    if (!context.auth) 
    {
        throw new functions.https.HttpsError('unauthenticated',  'Authentication Required')
    }

    if(!data.userIdToChallenge)
    {
        throw new functions.https.HttpsError('invalid-argument', "Function expected userIdToChallenge, but it was not found" )
    }
    if(!data.ladderId)
    {
        throw new functions.https.HttpsError('invalid-argument', "Function expected ladderId, but it was not found" )
    }

    return challengeMethods.CreateChallenge(data.userIdToChallenge, data.ladderId, context.auth.uid).then((result) => {
        return result;
    }).catch((ex) => {
        if (ex.errorcode)
        {
            throw new functions.https.HttpsError(ex.errorcode,  ex.message)
        }
        throw new functions.https.HttpsError('internal',  'An unknown error occured')
    });
})

exports.acceptChallenge = functions.https.onCall(async (challengeID,context) => {
    const db = admin.firestore();

    if (!context.auth) 
    {
        throw new functions.https.HttpsError('unauthenticated',  'Authentication Required')
    }
    
    if(!challengeID)
    {
        throw new functions.https.HttpsError('invalid-argument', "Function expected challengeID, but it was not found" )
    }

    //check correct user ID
    const challengeRef = db.collection('challenge').doc(challengeID);

    //get challenge data
    var challengeSnapshot = await challengeRef.get();
    if (!challengeSnapshot.exists)
    {
        throw new functions.https.HttpsError('not-found',  'The challenge could not be found')
    }

    let challengeData = challengeSnapshot.data()
    if (challengeData.user1 != context.auth.uid)
    {
        throw new functions.https.HttpsError('permission-denied',  'You cannot accept this challenge')
    }

    return challengeMethods.AcceptChallengeWithID(challengeID).then((result) => {
        return result;
    }).catch((ex) => {
        if (ex.errorcode)
        {
            throw new functions.https.HttpsError(ex.errorcode,  ex.message)
        }
        throw new functions.https.HttpsError('internal',  ex)
    });   
})

exports.declineChallenge = functions.https.onCall(async (challengeID,context) => {
    const db = admin.firestore();
    
    if (!context.auth) 
    {
        throw new functions.https.HttpsError('unauthenticated',  'Authentication Required')
    }
    
    if(!challengeID)
    {
        throw new functions.https.HttpsError('invalid-argument', "Function expected challengeID, but it was not found" )
    }

    //check correct user ID
    const challengeRef = db.collection('challenge').doc(challengeID);

    //get challenge data
    var challengeSnapshot = await challengeRef.get();
    if (!challengeSnapshot.exists)
    {
        throw new functions.https.HttpsError('not-found',  'The challenge could not be found')
    }

    let challengeData = challengeSnapshot.data()
    if (challengeData.user1 != context.auth.uid)
    {
        throw new functions.https.HttpsError('permission-denied',  'You cannot decline this challenge')
    }

    return challengeMethods.DeclineChallengeWithIdFromUser(challengeID, context.auth.uid).then((result) => {
        return result;
    }).catch((ex) => {
        if (ex.errorcode)
        {
            throw new functions.https.HttpsError(ex.errorcode,  ex.message)
        }
        throw new functions.https.HttpsError('internal',  ex)
    });   
})

exports.deleteChallenge = functions.https.onCall(async (challengeID,context) => {
    const db = admin.firestore();
    
    if (!context.auth) 
    {
        throw new functions.https.HttpsError('unauthenticated',  'Authentication Required')
    }
    
    if(!challengeID)
    {
        throw new functions.https.HttpsError('invalid-argument', "Function expected challengeID, but it was not found" )
    }


    //check correct user ID
    const challengeRef = db.collection('challenge').doc(challengeID);

    //get challenge data
    var challengeSnapshot = await challengeRef.get();
    if (!challengeSnapshot.exists)
    {
        throw new functions.https.HttpsError('not-found',  'The challenge could not be found')
    }

    let challengeData = challengeSnapshot.data()
    if (challengeData.user1 != context.auth.uid && challengeData.user2 != context.auth.uid)
    {
        throw new functions.https.HttpsError('permission-denied',  'You cannot decline this challenge')
    }

    return challengeMethods.DeleteChallengeBySnapshot(challengeSnapshot).then((result) => {
        return result;
    }).catch((ex) => {
        if (ex.errorcode)
        {
            throw new functions.https.HttpsError(ex.errorcode,  ex.message)
        }
        throw new functions.https.HttpsError('internal',  ex)
    });   
})

exports.addWinnerToChallenge = functions.https.onCall(async (data,context) => {
    if (!context.auth) 
    {
        throw new functions.https.HttpsError('unauthenticated',  'Authentication Required')
    }

    if(!data.challengeId)
    {
        throw new functions.https.HttpsError('invalid-argument', "Function expected userIdToChallenge, but it was not found" )
    }
    if(!data.winnerId)
    {
        throw new functions.https.HttpsError('invalid-argument', "Function expected ladderId, but it was not found" )
    }

    return challengeMethods.AddWinnerToChallenge(data.challengeId, data.winnerId, context.auth.uid).then((result) => {
        return result;
    }).catch((ex) => {
        if (ex.errorcode)
        {
            throw new functions.https.HttpsError(ex.errorcode,  ex.message)
        }
        throw new functions.https.HttpsError('internal',  ex)
    });  
})

exports.confirmWinner = functions.https.onCall(async (challengeID,context) => {
    const db = admin.firestore();
    
    if (!context.auth) 
    {
        throw new functions.https.HttpsError('unauthenticated',  'Authentication Required')
    }
    
    if(!challengeID)
    {
        throw new functions.https.HttpsError('invalid-argument', "Function expected challengeID, but it was not found" )
    }

    //check correct user ID
    const challengeRef = db.collection('challenge').doc(challengeID);

    //get challenge data
    var challengeSnapshot = await challengeRef.get();
    if (!challengeSnapshot.exists)
    {
        throw new functions.https.HttpsError('not-found',  'The challenge could not be found')
    }

    let challengeData = challengeSnapshot.data()
    
    if (!(challengeData.user1 != context.auth.uid || challengeData.user2 != context.auth.uid) || challengeData.winnerSelectedBy == context.auth.uid)
    {
        throw new functions.https.HttpsError('permission-denied',  'You cannot complete this challenge')
    }

    return challengeMethods.ConfirmChallenge(challengeSnapshot, context.auth.uid).then((result) => {
        return result;
    }).catch((ex) => {
        if (ex.errorcode)
        {
            throw new functions.https.HttpsError(ex.errorcode,  ex.message)
        }
        throw new functions.https.HttpsError('internal',  ex)
    }); 
})

exports.declineWinner = functions.https.onCall(async (challengeID,context) => {
    const db = admin.firestore();
    
    if (!context.auth) 
    {
        throw new functions.https.HttpsError('unauthenticated',  'Authentication Required')
    }
    
    if(!challengeID)
    {
        throw new functions.https.HttpsError('invalid-argument', "Function expected challengeID, but it was not found" )
    }

    //check correct user ID
    const challengeRef = db.collection('challenge').doc(challengeID);

    //get challenge data
    var challengeSnapshot = await challengeRef.get();
    if (!challengeSnapshot.exists)
    {
        throw new functions.https.HttpsError('not-found',  'The challenge could not be found')
    }

    let challengeData = challengeSnapshot.data()
    if (!(challengeData.user1 != context.auth.uid || challengeData.user2 != context.auth.uid) || challengeData.winnerSelectedBy == context.auth.uid)
    {
        throw new functions.https.HttpsError('permission-denied',  'You cannot complete this challenge')
    }

    return challengeMethods.DeclineWinner(challengeID, context.auth.uid).then((result) => {
        return result;
    }).catch((ex) => {
        if (ex.errorcode)
        {
            throw new functions.https.HttpsError(ex.errorcode,  ex.message)
        }
        throw new functions.https.HttpsError('internal',  ex)
    });   
})


