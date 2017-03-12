'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var Promise = require('bluebird');
var streamToPromise = require('stream-to-promise');
var rp = require('request-promise');

var url = 'https://graph-video.facebook.com';

function apiInit(args, videoSize) {
	var options = {
		method: 'POST',
		uri: url + '/v2.6/' + args.id + '/videos?access_token=' + args.token,
		json: true,
		form: _extends({
			upload_phase: 'start',
			file_size: videoSize
		}, args['initParameters'])
	};

	return rp(options);
}

function apiFinish(args, id, video_id) {
	var options = {
		method: 'POST',
		uri: url + '/v2.6/' + args.id + '/videos',
		form: _extends({
			access_token: args.token,
			upload_phase: 'finish',
			upload_session_id: id
		}, args['initParameters']),
		json: true
	};

	return rp(options).then(function (res) {
		res.video_id = video_id;
		return res;
	});
}

function uploadChunk(args, id, start, chunk) {
	var formData = {
		access_token: args.token,
		upload_phase: 'transfer',
		start_offset: start,
		upload_session_id: id,
		video_file_chunk: {
			value: chunk,
			options: {
				filename: 'chunk'
			}
		}
	};
	var options = {
		method: 'POST',
		uri: url + '/v2.6/' + args.id + '/videos',
		formData: formData,
		json: true
	};

	return rp(options);
}

function uploadChain(buffer, args, res, ids) {
	if (res.start_offset === res.end_offset) {
		return ids;
	}
	var chunk = buffer.slice(res.start_offset, res.end_offset);
	return uploadChunk(args, ids[0], res.start_offset, chunk).then(function (res) {
		return uploadChain(buffer, args, res, ids);
	});
}

function facebookApiVideoUpload(args) {
	return Promise.resolve(streamToPromise(args.stream)).then(function (buffer) {
		return buffer;
	}).then(function (buffer) {
		return [buffer, apiInit(args, buffer.length)];
	}).spread(function (buffer, res) {
		var ids = [res.upload_session_id, res.video_id];
		return uploadChain(buffer, args, res, ids);
	}).spread(function (id, video_id) {
		return apiFinish(args, id, video_id);
	});
}

module.exports = facebookApiVideoUpload;