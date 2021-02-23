const functions = require('firebase-functions');
const admin = require('firebase-admin');
const FieldValue = require('firebase-admin').firestore.FieldValue;

//INVITE AN ADMIN TO A LADDER
exports.addAdmin = functions.https.onCall(async (data,context) => {
    
    const db = admin.firestore();
    const toUser = db.collection('users').doc(data.toUserID);
    const inLadder = db.collection('ladders').doc(data.ladderID);

    //check is user is not already an admin
    let snapshot = await db.collection('ladders').where('admins', 'array-contains', data.toUserID).get();

    //check if user already invited as an admin
    let snapshot2 = await db.collection('notifications').where('ladder', '==', inLadder).where('toUser', '==', toUser).where('type', '==', 'admin').get()

    
    const dataToSave = {
        toUser: toUser,
        ladder: inLadder,
        message: data.message,
        title: data.title,
        fromUser: db.collection('users').doc(data.fromUser),
        type: data.type
    };
      
    if (snapshot.empty && snapshot2.empty) {
        //go ahead with notificaton
        await db.collection('notifications').doc().set(dataToSave);
        const dataToReturn = {
            title: "Invitation Sent",
            message: data.username + " has been invited as an admin"
        };
        return dataToReturn;
    }
    else if (snapshot2.empty && (snapshot.docRef != inLadder)){
        await db.collection('notifications').doc().set(dataToSave);
        const dataToReturn = {
            title: "Error",
            message: data.username + " has already been invited as an admin"
        };
        return dataToReturn;
    }
    else{
        //user already invited. Do not send again
        const dataToReturn = {
            title: "Invitation Sent",
            message: data.username + " is already or has been invited to become an admin"
        };
        return dataToReturn;
    }
})

//INVITES A USER TO A LADDER
exports.inviteUser = functions.https.onCall(async (data,context) => {
    
    const db = admin.firestore();
    const toUser = db.collection('users').doc(data.toUserID);
    const inLadder = db.collection('ladders').doc(data.ladderID);

    //check is user is not already in the ladder
    let ladderSnp = await inLadder.get();

    if (ladderSnp.exists) {
        let docData = ladderSnp.data()
        let userList = docData.positions;
        var alreadyInLadder = userList.includes(data.toUserID);
        if (alreadyInLadder){
            const dataToReturn = {
                title: "Error",
                message: data.username + " is already in the ladder"
            };
            return dataToReturn;
        }
    } 
    //check if user already invited
    let snapshot = await db.collection('notifications').where('ladder', '==', inLadder).where('toUser', '==', toUser).where('type', '==', 'invite').get()

    const dataToSave = {
        toUser: toUser,
        ladder: inLadder,
        message: data.message,
        title: data.title,
        fromUser: db.collection('users').doc(data.fromUser),
        type: data.type
    };
      

    if (snapshot.empty) {
        //go ahead with notificaton
        await db.collection('notifications').doc().set(dataToSave);
        const dataToReturn = {
            title: "Invitation Sent",
            message: data.username + " has been invited to the ladder"
        };
        return dataToReturn;
    } 
    else{
        //user already invited. Do not send again
        const dataToReturn = {
            title: "Invitation Sent",
            message: data.username + "  already invited to this ladder"
        };
        return dataToReturn;
    }
})

