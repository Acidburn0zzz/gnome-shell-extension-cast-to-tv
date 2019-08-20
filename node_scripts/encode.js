var { spawn } = require('child_process');
var debug = require('debug')('ffmpeg');
var bridge = require('./bridge');
var extract = require('./extract');
var gnome = require('./gnome');
var messages = require('./messages.js');
var shared = require('../shared');

var subsPathEscaped;
var codecAudio = 'copy';
var stdioConf = (debug.enabled === true) ? 'inherit' : 'ignore';

exports.streamProcess = null;

String.prototype.replaceAt = function(index, replacement)
{
	return this.substr(0, index) + replacement + this.substr(index + 1);
}

function getSubsPath()
{
	if(bridge.selection.subsPath) subsPathEscaped = bridge.selection.subsPath;
	else subsPathEscaped = bridge.selection.filePath;

	var i = subsPathEscaped.length;

	while(i--)
	{
		if(shared.escapeChars.indexOf(subsPathEscaped.charAt(i)) > -1)
		{
			subsPathEscaped = subsPathEscaped.replaceAt(i, '\\' + subsPathEscaped.charAt(i));
		}
	}
}

function createEncodeProcess(encodeOpts)
{
	exports.streamProcess = spawn(bridge.config.ffmpegPath, encodeOpts,
	{ stdio: ['ignore', 'pipe', stdioConf] });

	var notifyError = false;

	exports.streamProcess.once('close', (code) =>
	{
		if(code && !notifyError) gnome.notify('Cast to TV', messages.ffmpegError + " " + bridge.selection.filePath);
		exports.streamProcess = null;
	});

	exports.streamProcess.once('error', (error) =>
	{
		if(error.message == 'spawn ' + bridge.config.ffmpegPath + ' ENOENT')
		{
			gnome.notify('Cast to TV', messages.ffmpegPath);
			notifyError = true;
		}
	});

	return exports.streamProcess.stdout;
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
	'-c:a', codecAudio,
	'-metadata', 'title=Cast to TV - Software Encoded Stream',
	'-f', 'matroska',
	'pipe:1'
	];

	if(extract.subtitlesBuiltIn || bridge.selection.subsPath)
	{
		getSubsPath();
		encodeOpts.splice(encodeOpts.indexOf('libx264') + 1, 0, '-vf', 'subtitles=' + subsPathEscaped, '-sn');
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
	'-c:a', codecAudio,
	'-metadata', 'title=Cast to TV - VAAPI Encoded Stream',
	'-f', 'matroska',
	'pipe:1'
	];

	if(extract.subtitlesBuiltIn || bridge.selection.subsPath)
	{
		getSubsPath();
		encodeOpts.unshift('-hwaccel', 'vaapi', '-hwaccel_device', '/dev/dri/renderD128', '-hwaccel_output_format', 'vaapi');
		encodeOpts.splice(encodeOpts.indexOf('h264_vaapi') + 1, 0,
			'-vf', 'scale_vaapi,hwmap=mode=read+write,format=nv12,subtitles=' + subsPathEscaped + ',hwmap', '-sn');
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
	'-c:a', codecAudio,
	'-metadata', 'title=Cast to TV - NVENC Encoded Stream',
	'-f', 'matroska',
	'pipe:1'
	];

	if(extract.subtitlesBuiltIn || bridge.selection.subsPath)
	{
		getSubsPath();
		encodeOpts.splice(encodeOpts.indexOf('h264_nvenc') + 1, 0,
			'-vf', 'subtitles=' + subsPathEscaped, '-sn');
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
	'-c:a', codecAudio,
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
		try { process.kill(exports.streamProcess.pid, 'SIGHUP'); }
		catch(err) {}
	}
}
