const { spawn } = require('child_process');
const debug = require('debug')('ffmpeg');
const bridge = require('./bridge');
const notify = require('./notify');
const messages = require('./messages.js');
const shared = require('../shared');
const stdioConf = (debug.enabled) ? 'inherit' : 'ignore';

exports.streamProcess = null;
var notifyError = false;

String.prototype.replaceAt = function(index, replacement)
{
	return this.substr(0, index) + replacement + this.substr(index + 1);
}

function getSubsPath()
{
	var subsPathEscaped = (bridge.selection.subsPath) ? bridge.selection.subsPath : bridge.selection.filePath;
	var index = subsPathEscaped.length;

	debug('Parsing subtitles path...');

	while(index--)
	{
		if(shared.escapeChars.includes(subsPathEscaped.charAt(index)))
			subsPathEscaped = subsPathEscaped.replaceAt(index, '\\' + subsPathEscaped.charAt(index));
	}

	debug(`Parsed subtitles path: ${subsPathEscaped}`);

	return subsPathEscaped;
}

function getAudioOptsArray()
{
	return (bridge.selection.transcodeAudio) ? ['flac', '-ac', '2'] : ['copy'];
}

function createEncodeProcess(encodeOpts)
{
	debug(`Starting FFmpeg with opts: ${JSON.stringify(encodeOpts)}`);

	exports.streamProcess = spawn(bridge.config.ffmpegPath, encodeOpts,
	{ stdio: ['ignore', 'pipe', stdioConf] });

	notifyError = false;
	exports.streamProcess.once('exit', onAutoExit);
	exports.streamProcess.once('error', onEncodeError);

	return exports.streamProcess.stdout;
}

function onAutoExit(code)
{
	if(!notifyError)
	{
		exports.streamProcess.removeListener('error', onEncodeError);

		if(code) notify('Cast to TV', messages.ffmpegError, bridge.selection.filePath);
	}

	exports.streamProcess = null;

	if(code !== null)
		debug(`FFmpeg exited with code: ${code}`);

	debug('FFmpeg auto exit');
}

function onManualExit(code)
{
	if(!notifyError)
		exports.streamProcess.removeListener('error', onEncodeError);

	exports.streamProcess = null;
	debug('FFmpeg manual exit');
}

function onEncodeError(error)
{
	if(error.message == 'spawn ' + bridge.config.ffmpegPath + ' ENOENT')
	{
		notify('Cast to TV', messages.ffmpegPath);
		notifyError = true;
	}

	debug('FFmpeg had error!');
	debug(error);
}

exports.video = function()
{
	var encodeOpts = [
	'-i', bridge.selection.filePath,
	'-c:v', 'libx264',
	'-pix_fmt', 'yuv420p',
	'-preset', 'superfast',
	'-level:v', '4.1',
	'-b:v', bridge.config.videoBitrate + 'M',
	'-c:a', ...getAudioOptsArray(),
	'-metadata', 'title=Cast to TV - Software Encoded Stream',
	'-f', 'matroska',
	'pipe:1'
	];

	if(bridge.mediaData.isSubsMerged || bridge.selection.subsPath)
	{
		encodeOpts.splice(
			encodeOpts.indexOf('libx264') + 1, 0,
			'-vf', 'subtitles=' + getSubsPath(), '-sn'
		);
	}

	return createEncodeProcess(encodeOpts);
}

exports.videoVaapi = function()
{
	var encodeOpts = [
	'-i', bridge.selection.filePath,
	'-c:v', 'h264_vaapi',
	'-level:v', '4.1',
	'-b:v', bridge.config.videoBitrate + 'M',
	'-c:a', ...getAudioOptsArray(),
	'-metadata', 'title=Cast to TV - VAAPI Encoded Stream',
	'-f', 'matroska',
	'pipe:1'
	];

	if(bridge.mediaData.isSubsMerged || bridge.selection.subsPath)
	{
		encodeOpts.unshift(
			'-hwaccel', 'vaapi',
			'-hwaccel_device', '/dev/dri/renderD128',
			'-hwaccel_output_format', 'vaapi'
		);
		encodeOpts.splice(
			encodeOpts.indexOf('h264_vaapi') + 1, 0,
			'-vf', 'scale_vaapi,hwmap=mode=read+write,format=nv12,subtitles=' +
			getSubsPath() + ',hwmap', '-sn'
		);
	}
	else
	{
		encodeOpts.unshift('-vaapi_device', '/dev/dri/renderD128');
		encodeOpts.splice(encodeOpts.indexOf('h264_vaapi') + 1, 0, '-vf', 'format=nv12,hwmap');
	}

	return createEncodeProcess(encodeOpts);
}

exports.videoNvenc = function()
{
	var encodeOpts = [
	'-i', bridge.selection.filePath,
	'-c:v', 'h264_nvenc',
	'-level:v', '4.1',
	'-b:v', bridge.config.videoBitrate + 'M',
	'-c:a', ...getAudioOptsArray(),
	'-metadata', 'title=Cast to TV - NVENC Encoded Stream',
	'-f', 'matroska',
	'pipe:1'
	];

	if(bridge.mediaData.isSubsMerged || bridge.selection.subsPath)
	{
		encodeOpts.splice(
			encodeOpts.indexOf('h264_nvenc') + 1, 0,
			'-vf', 'subtitles=' + getSubsPath(), '-sn'
		);
	}

	return createEncodeProcess(encodeOpts);
}

exports.musicVisualizer = function()
{
	var encodeOpts = [
	'-i', bridge.selection.filePath,
	'-filter_complex',
	`firequalizer=gain='(1.4884e8 * f*f*f / (f*f + 424.36) / (f*f + 1.4884e8) / sqrt(f*f + 25122.25)) / sqrt(2)':
	scale=linlin:
	wfunc=tukey:
	zero_phase=on:
	fft2=on,
	showcqt=fps=60:
	size=1280x360:
	count=1:
	csp=bt470bg:
	cscheme=1|0|0.5|0|1|0.5:
	bar_g=2:
	sono_g=4:
	bar_v=9:
	sono_v=17:
	sono_h=0:
	bar_t=0.5:
	axis_h=0:
	tc=0.33:
	tlength='st(0,0.17); 384*tc / (384 / ld(0) + tc*f /(1-ld(0))) + 384*tc / (tc*f / ld(0) + 384 /(1-ld(0)))',
	format=yuv420p,split [v0],vflip [v1]; [v0][v1] vstack [vis]`,
	'-map', '[vis]',
	'-map', '0:a',
	'-c:v', 'libx264',
	'-pix_fmt', 'yuv420p',
	'-preset', 'superfast',
	'-level:v', '4.1',
	'-b:v', bridge.config.videoBitrate + 'M',
	'-c:a', 'copy',
	'-metadata', 'title=Cast to TV - Music Visualizer',
	'-f', 'matroska',
	'pipe:1'
	];

	return createEncodeProcess(encodeOpts);
}

exports.closeStreamProcess = function()
{
	if(exports.streamProcess)
	{
		if(exports.streamProcess.stdout)
		{
			exports.streamProcess.removeListener('exit', onAutoExit);
			exports.streamProcess.once('exit', onManualExit);

			if(!exports.streamProcess.stdout.destroyed)
			{
				exports.streamProcess.stdout.destroy();
				debug('Destroyed stream process remaining stdout data');
			}
			else
				debug('Stream process stdout was destroyed earlier');

			exports.streamProcess.stdout = null;
		}
		else
		{
			debug('Force killing stream process...');

			try {
				process.kill(exports.streamProcess.pid, 'SIGHUP');
				debug('Force killed stream process');
			}
			catch(err) {
				debug('Could not kill stream process!');
				debug(err);
			}
		}
	}
}
