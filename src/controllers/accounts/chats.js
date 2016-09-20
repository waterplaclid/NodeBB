'use strict';

var async = require('async');

var messaging = require('../../messaging');
var meta = require('../../meta');
var user = require('../../user');
var helpers = require('../helpers');


var chatsController = {};

chatsController.get = function(req, res, callback) {
	if (parseInt(meta.config.disableChat, 10) === 1) {
		return callback();
	}
	var uid;
	var recentChats;
	async.waterfall([
		function(next) {
			user.getUidByUserslug(req.params.userslug, next);
		},
		function(_uid, next) {
			uid = _uid;
			if (!uid) {
				return callback();
			}
			messaging.getRecentChats(uid, 0, 19, next);
		},
		function(_recentChats, next) {
			recentChats = _recentChats;
			if (!req.params.roomid) {
				return res.render('chats', {
					rooms: recentChats.rooms,
					userslug: req.params.userslug,
					nextStart: recentChats.nextStart,
					allowed: true,
					title: '[[pages:chats]]',
					breadcrumbs: helpers.buildBreadcrumbs([{text: '[[pages:chats]]'}])
				});
			}
			messaging.isUserInRoom(req.uid, req.params.roomid, next);
		},
		function(inRoom, next) {
			if (!inRoom && parseInt(req.uid, 10) === parseInt(uid, 10)) {
				return callback();
			}
			async.parallel({
				users: async.apply(messaging.getUsersInRoom, req.params.roomid, 0, -1),
				messages: async.apply(messaging.getMessages, {
					uid: uid,
					roomId: req.params.roomid,
					since: 'recent',
					isNew: false
				}),
				room: async.apply(messaging.getRoomData, req.params.roomid)
			}, next);
		}
	], function(err, data) {
		if (err) {
			return callback(err);
		}
		var room = data.room;
		room.messages = data.messages;

		room.isOwner = parseInt(room.owner, 10) === parseInt(req.uid, 10);
		room.users = data.users.filter(function(user) {
			return user && parseInt(user.uid, 10) && parseInt(user.uid, 10) !== req.uid;
		});

		room.rooms = recentChats.rooms;
		room.userslug = req.params.userslug;
		room.nextStart = recentChats.nextStart;
		room.title = room.roomName;
		room.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[pages:chats]]', url: '/chats'}, {text: room.roomName}]);
		room.maximumUsersInChatRoom = parseInt(meta.config.maximumUsersInChatRoom, 10) || 0;
		room.maximumChatMessageLength = parseInt(meta.config.maximumChatMessageLength, 10) || 1000;
		room.showUserInput = !room.maximumUsersInChatRoom || room.maximumUsersInChatRoom > 2;

		res.render('chats', room);
	});
};



module.exports = chatsController;