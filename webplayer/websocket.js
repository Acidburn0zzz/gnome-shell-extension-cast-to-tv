var websocket = io();

/* Web player related websocket functions */
if(typeof player !== 'undefined')
{
	var progress = 0;
	var playbackStarted = false;

	var statusContents = {
		playerState: 'PAUSED',
		currentTime: 0,
		media: { duration: 0 },
		volume: player.volume
	};

	websocket.emit('webplayer', 'webplayer-ask');

	websocket.on('webplayer-init', msg => preparePlayer(msg));
	player.on('ended', () => websocket.emit('webplayer', 'track-ended'));

	player.on('loadeddata', () =>
	{
		/* Workaround Plyr volume bug */
		player.currentTime = 0;

		statusContents.media.duration = player.duration;
	});

	player.on('canplay', () =>
	{
		if(!playbackStarted) player.play();
	});

	player.on('playing', () =>
	{
		playbackStarted = true;
		statusContents.playerState = 'PLAYING';
		websocket.emit('status-update', statusContents);
	});

	player.on('pause', () =>
	{
		statusContents.playerState = 'PAUSED';
		websocket.emit('status-update', statusContents);
	});

	player.on('timeupdate', () =>
	{
		progress++;

		/* Reduce event frequency */
		if(progress % 5 == 0)
		{
			progress = 0;
			statusContents.currentTime = player.currentTime;
			websocket.emit('status-update', statusContents);
		}
	});

	player.on('seeked', () =>
	{
		progress = 0;
		statusContents.currentTime = player.currentTime;
		websocket.emit('status-update', statusContents);
	});

	player.on('volumechange', () =>
	{
		if(player.muted) statusContents.volume = 0;
		else statusContents.volume = player.volume;

		websocket.emit('status-update', statusContents);
	});

	websocket.on('remote-signal', msg =>
	{
		switch(msg.action)
		{
			case 'PLAY':
				player.play();
				break;
			case 'PAUSE':
				player.pause();
				break;
			case 'SEEK':
				player.currentTime = statusContents.media.duration * msg.value;
				break;
			case 'SEEK+':
				player.forward(msg.value);
				break;
			case 'SEEK-':
				player.rewind(msg.value);
				break;
			case 'VOLUME':
				player.volume = msg.value;
				break;
			case 'STOP':
				player.stop();
				break;
			default:
				break;
		}
	});
}

websocket.on('reload', () =>
{
	websocket.disconnect();
	location.reload(true);
});
