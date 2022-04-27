const functions = require('firebase-functions');
const admin = require('firebase-admin');
const FieldValue = require('firebase-admin').firestore.FieldValue;


admin.initializeApp(functions.config().firebase);

const systemFunctions = require('./systemFunctions');
const ladderFunctions = require('./ladderFunctions');
const challengeFunctions = require('./challengeFunctions');
const inviteFunctions = require('./invites');
const respondFunctions = require('./respondNotifications');
const accountFunctions = require('./account');
const testFunctions = require('./testFunctions');

const notificationsAPI = require('./endpoints/notificationsAPI');
const challengeAPI = require('./endpoints/challengeAPI');


//SYSTEM
exports.sendNotificationToFCMToken = systemFunctions.sendNotificationToFCMToken;
exports.checkUsername = systemFunctions.checkUsername;
exports.deleteUser = systemFunctions.deleteUser;


//LADDER
exports.withdrawUserFromLadder = ladderFunctions.withdrawUserFromLadder;
exports.requestToJoinALadder = ladderFunctions.requestToJoinALadder;
exports.acceptRequest = ladderFunctions.acceptRequest;
exports.deleteUserFromAdmin = ladderFunctions.deleteUserFromAdmin;
exports.deleteLadder = ladderFunctions.deleteLadder;
exports.rejectRequest = ladderFunctions.rejectRequest;
exports.rejectNormalInvite = ladderFunctions.rejectNormalInvite;
exports.rejectAdminInvite = ladderFunctions.rejectAdminInvite;
exports.checkName = ladderFunctions.checkName;
exports.createLadder = ladderFunctions.createLadder;
exports.removeInvites = ladderFunctions.removeInvites;
exports.removeAdmin = ladderFunctions.removeAdmin;

//CHALLENGE
exports.deleteChallenge = challengeFunctions.deleteChallenge;
exports.addWinnerToChallenge = challengeFunctions.addWinnerToChallenge;


//INVITES
exports.addAdmin = inviteFunctions.addAdmin;
exports.inviteUser = inviteFunctions.inviteUser;

//RESPOND
exports.acceptAdminInvite = respondFunctions.acceptAdminInvite;

//ACCOUNT
exports.saveAccountChanges = accountFunctions.saveAccountChanges;

//TEST FUNCTIONS
exports.returnAnError = testFunctions.returnAnError;


//Challenge API
exports.createChallenge = challengeAPI.createChallenge;
exports.acceptChallenge = challengeAPI.acceptChallenge;
exports.declineChallenge = challengeAPI.declineChallenge;
exports.addWinnerToChallenge = challengeAPI.addWinnerToChallenge;
exports.confirmWinner = challengeAPI.confirmWinner;
exports.declineWinner = challengeAPI.declineWinner;
exports.deleteChallenge = challengeAPI.deleteChallenge;
