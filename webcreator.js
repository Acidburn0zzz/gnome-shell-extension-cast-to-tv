const fs = require('fs');
const rangeParser = require('range-parser');
const configbridge = require('./configbridge');
const encodesettings = require('./encodesettings');
const webplayerSubsPath = '/tmp/webplayer_subs.vtt';
var streamType, filePath, subsPath, musicVisualizer;

exports.fileStream = function(req, res)
{
	streamType = configbridge.config.streamType;
	filePath = configbridge.config.filePath;

	if(!filePath)
	{
		res.statusCode = 404;
		res.end("No media file selected!");
		return;
	}

	/* Return if file does not exist or cannot be read */
	var exist = fs.existsSync(filePath);

	if(exist)
	{
		res.setHeader('Access-Control-Allow-Origin', '*');

		/* Pipe picture stream and exit function */
		if(streamType == 'PICTURE')
		{
			res.setHeader('Content-Type', 'image/png');
			return fs.createReadStream(filePath).pipe(res);
		}

		res.setHeader('Content-Type', 'application/octet-stream');

		/* Calculate file range for chunked streaming */
		var stat = fs.statSync(filePath);
		var total = stat.size;
		var range = req.headers.range;

		if (!range)
		{
			res.setHeader('Content-Length', total);
			res.statusCode = 200;
			return fs.createReadStream(filePath).pipe(res);
		}

		var part = rangeParser(total, range)[0];
		var chunksize = (part.end - part.start) + 1;
		var file = fs.createReadStream(filePath, {start: part.start, end: part.end});

		res.setHeader('Content-Range', 'bytes ' + part.start + '-' + part.end + '/' + total);
		res.setHeader('Accept-Ranges', 'bytes');
		res.setHeader('Content-Length', chunksize);
		res.statusCode = 206;
		return file.pipe(res);
	}
	else
	{
		res.statusCode = 404;
		res.end(`File ${filePath} not found!`);
	}
}

exports.encodedStream = function(req, res)
{
	filePath = configbridge.config.filePath;
	videoBitrate = configbridge.config.videoBitrate;

	if(!filePath)
	{
		res.statusCode = 404;
		res.end("No media file selected!");
		return;
	}

	/* Prevent spawning more then one ffmpeg encode process */
	if(encodesettings.streamProcess)
	{
		res.statusCode = 429;
		res.end("Streaming is already active!");
		return;
	}

	res.setHeader('Content-Type', 'application/octet-stream');
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Connection', 'keep-alive');
	res.statusCode = 200;

	streamType = configbridge.config.streamType;

	/* Return if file does not exist or cannot be read */
	var exist = fs.existsSync(filePath);

	if(exist)
	{
		if(streamType == 'VIDEO_ENCODE') encodesettings.videoConfig().stdout.pipe(res);
		else if(streamType == 'VIDEO_VAAPI') encodesettings.videoVaapiConfig().stdout.pipe(res);
		else if(streamType == 'VIDEO_NVENC') encodesettings.videoNvencConfig().stdout.pipe(res);
		else if(streamType == 'MUSIC') encodesettings.musicVisualizerConfig().stdout.pipe(res);
		else res.end();
	}
	else
	{
		res.statusCode = 404;
		res.end(`File ${filePath} not found!`);
	}
}

exports.subsStream = function(req, res)
{
	subsPath = configbridge.config.subsPath;

	res.setHeader('Content-Type', 'text/vtt');
	res.setHeader('Access-Control-Allow-Origin', '*');

	/* When no subs selected try with extracted subs */
	if(!subsPath)
	{
		subsPath = webplayerSubsPath;
	}

	/* Return if file does not exist or cannot be read */
	var exist = fs.existsSync(subsPath);

	if(exist)
	{
		res.statusCode = 200;
		if(req.url == '/subswebplayer') return fs.createReadStream(webplayerSubsPath).pipe(res);
		else return fs.createReadStream(subsPath).pipe(res);
	}
	else
	{
		res.statusCode = 302;
		res.end();
	}
}

exports.pageWrong = function(req, res)
{
	res.statusCode = 400;
	res.end(`Bad Request!`);
}
