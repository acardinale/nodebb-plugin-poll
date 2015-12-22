"use strict";

var async = require('async'),

	NodeBB = require('./nodebb'),

	Poll = require('./poll');

(function(Vote) {

	Vote.add = function(voteData, callback) {
		var pollId = voteData.pollId,
			options = voteData.options,
			uid = voteData.uid;

		async.parallel({
			options: function(next) {
				async.each(options, function(option, next) {
					async.parallel([
						// Increase option vote count
						async.apply(NodeBB.db.incrObjectField, 'poll:' + pollId + ':options:' + option),
						// Add uid to list of votes
						async.apply(NodeBB.db.setAdd, 'poll:' + pollId + ':options:' + option + ':votes', uid)
					], next);
				}, function(err) {
					// Get poll options for callback
					Poll.getOptions(pollId, next);
				});
			},
			info: function(next) {
				async.parallel([
					// Add uid to poll voters
					async.apply(NodeBB.db.setAdd, 'poll:' + pollId + ':voters', uid),
					// Increase poll vote count
					async.apply(NodeBB.db.incrObjectFieldBy, 'poll:' + pollId, 'votecount', options.length)
				], function(err, result) {
					next(err, {
						voteCount: result[1]
					})
				});
			}
		}, callback);
	};

	Vote.remove = function(voteData, callback) {
		var pollId = voteData.pollId,
			options = voteData.options,
			uid = voteData.uid;

		async.parallel({
			options: function(next) {
				async.each(options, function(option, next) {
					async.parallel([
						// Decrease option vote count
						async.apply(NodeBB.db.decrObjectField, 'poll:' + pollId + ':options:' + option, 'votecount'),
						// Remove uid from list of votes
						async.apply(NodeBB.db.setRemove, 'poll:' + pollId + ':options:' + option + ':votes', uid)
					], next);
				}, function(err) {
					//Get poll options for callback
					Poll.getOptions(pollId, next);
				});
			},
			info: function(next) {
				async.parallel([
					// Remove uid from poll voters
					async.apply(NodeBB.db.setRemove, 'poll:' + pollId + ':voters', uid),
					// Decrease poll vote count
					async.apply(NodeBB.db.decrObjectFieldBy, 'poll:' + pollId, 'votecount', options.length)
				], function(err, result) {
					next(err, {
						voteCount: result[1]
					})
				});
			}
		}, callback);
	};

	Vote.canVote = function(uid, pollId, callback) {
		async.parallel([
			function(next) {
				// Ended?
				Poll.hasEnded(pollId, next);
			},
			function(next) {
				// Deleted?
				Poll.isDeleted(pollId, next);
			},
			function(next) {
				// Already voted?
				Vote.hasUidVoted(uid, pollId, next);
			}
		], function(err, result) {
			callback(err, result.indexOf(true) === -1);
		});
	};

	Vote.hasUidVoted = function(uid, pollId, callback) {
		NodeBB.db.isSetMember('poll:' + pollId + ':voters', uid, callback);
	};

	Vote.hasUidVotedOnOption = function(uid, pollId, option, callback) {
		NodeBB.db.isSetMember('poll:' + pollId + ':options:' + option + ':votes', uid, callback);
	};

})(exports);