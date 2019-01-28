const isMobile = (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Windows Phone/i.test(navigator.userAgent)) ? true : false;
const player = new Plyr('#player', playerOptions);
const subsReq = new XMLHttpRequest();
const configReq = new XMLHttpRequest();
const sessionID = makeID();

var enteredFullscreen;
var playerInit;
var subsKind = 'none';
var posterPath = '/webplayer/images/play.png';

/* Asynchronous XMLHttpRequests */
subsReq.open('HEAD', '/subswebplayer');
configReq.open('GET', '/config');

subsReq.send();
configReq.send();

subsReq.onreadystatechange = function()
{
	if(this.readyState == 4)
	{
		if(this.status == 200)
		{
			/* Enable subtitles */
			subsKind ='captions';
		}

		setPlyrSource();
	}
}

configReq.onreadystatechange = function()
{
	if(this.readyState == 4 && this.status == 200)
	{
		var config = JSON.parse(this.responseText);

		if(config.streamType == 'MUSIC' && !config.musicVisualizer)
		{
			posterPath = '/cover';
		}

		setPlyrSource();
	}
}

function setPlyrSource()
{
	player.source = {
		type: 'video',
		title: 'Cast to TV',
		sources: [{
			src: '/cast?session=' + sessionID,
			type: 'video/mp4'
		}],
		poster: posterPath,
		tracks: [{
			kind: subsKind,
			label: 'Subtitles',
			srclang: 'en',
			src: '/subswebplayer',
			default: true
		}]
	};
}

function makeID()
{
	var text = "";
	var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

	for(var i = 0; i < 10; i++)
	{
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}

	return text;
}

function startPlayer()
{
	/* Workaround Plyr volume bug */
	if(!playerInit)
	{
		player.currentTime = 0;
		playerInit = true;
	}

	/* When on mobile */ 
	if(isMobile)
	{
		/* Enter fullscreen after touch (only once) */
		if(!enteredFullscreen)
		{
			player.fullscreen.enter();
			enteredFullscreen = true;
		}

		/* Play and pause on touch */
		player.togglePlay();
	}
}
