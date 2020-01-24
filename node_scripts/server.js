const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const bridge = require('./bridge');
const webcreator = require('./web-creator');
const socket = require('./server-socket');
const encode = require('./encode');
const extract = require('./extract');
const gettext = require('./gettext');

var app = express();
var server = app.listen(bridge.config.listeningPort);

app.use(bodyParser.json());
socket.listen(server);
gettext.initTranslations();

exports.changePort = function(port)
{
	server.close();

	server = app.listen(port);
	socket.listen(server);
}

function checkMessagePage(req, res)
{
	var showMessage;

	if(
		bridge.config.receiverType != 'other'
		|| !bridge.selection.filePath
		|| encode.streamProcess
		|| socket.activeConnections > 0
	) {
		showMessage = true;
	}
	else {
		showMessage = false;
	}

	if(showMessage)
	{
		res.sendFile(path.join(__dirname + '/../webplayer/message.html'));
		return true;
	}

	if(extract.video.subsProcess || extract.music.coverProcess)
	{
		res.sendFile(path.join(__dirname + '/../webplayer/loading.html'));
		return true;
	}

	return false;
}

app.get('/', function(req, res)
{
	var lang = req.acceptsLanguages.apply(req, gettext.locales);

	if(lang) gettext.setLocale(lang);
	else gettext.setLocale('en');

	var isMessage = checkMessagePage(req, res);
	if(isMessage) return;

	switch(bridge.selection.streamType)
	{
		case 'VIDEO':
			res.sendFile(path.join(__dirname + '/../webplayer/webplayer_direct.html'));
			break;
		case 'MUSIC':
			if(bridge.config.musicVisualizer) res.sendFile(path.join(__dirname + '/../webplayer/webplayer_encode.html'));
			else res.sendFile(path.join(__dirname + '/../webplayer/webplayer_direct.html'));
			break;
		case 'PICTURE':
			res.sendFile(path.join(__dirname + '/../webplayer/picture.html'));
			break;
		default:
			res.sendFile(path.join(__dirname + '/../webplayer/webplayer_encode.html'));
	}
});

app.get('/cast', function(req, res)
{
	if(bridge.selection.addon)
	{
		/* Send to add-on if available, otherwise ignore request */
		if(bridge.addon)
			bridge.addon.fileStream(req, res, bridge.selection, bridge.config);
	}
	else
	{
		switch(bridge.selection.streamType)
		{
			case 'MUSIC':
				if(bridge.config.musicVisualizer)
					webcreator.encodedStream(req, res);
				else
					webcreator.fileStream(req, res);
				break;
			case 'VIDEO':
			case 'PICTURE':
				webcreator.fileStream(req, res);
				break;
			default:
				webcreator.encodedStream(req, res);
				break;
		}

		req.once('close', encode.closeStreamProcess);
	}
});

app.get('/subs(webplayer)?', function(req, res)
{
	if(bridge.selection.addon && bridge.selection.subsSrc)
		bridge.addon.subsStream(req, res, bridge.selection, bridge.config);
	else
		webcreator.subsStream(req, res);
});

app.get('/cover', function(req, res)
{
	if(bridge.selection.addon && bridge.selection.coverSrc)
		bridge.addon.coverStream(req, res, bridge.selection, bridge.config);
	else
		webcreator.coverStream(req, res);
});

app.get('/webplayer/webconfig.css', function(req, res)
{
	webcreator.webConfig(req, res);
});

app.get('/temp/*', function(req, res)
{
	webcreator.getTemp(req.params[0], req, res);
});

app.post('/temp/*', function(req, res)
{
	webcreator.postTemp(req.params[0], req, res);
});

app.get('/segment*', function(req, res)
{
	webcreator.hlsStream(req, res);
});

app.use('/webplayer', express.static(__dirname + '/../webplayer'));
app.use('/plyr', express.static(__dirname + '/../node_modules/plyr/dist'));

app.get('/*', function(req, res)
{
	webcreator.pageWrong(req, res);
});
