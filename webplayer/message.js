var websocket = io();
websocket.emit('message-ask');

var checkInterval = setInterval(() => { websocket.emit('message-ask'); }, 1000);
websocket.on('message-refresh', msg => { refreshMessage(msg); });
websocket.on('message-clear', () => { changePage(); });

function refreshMessage(msg)
{
	if(document.getElementById("msg").innerHTML != msg)
	{
		document.getElementById("msg").innerHTML = msg;
	}
}

function changePage()
{
	clearInterval(checkInterval);
	location.reload(true);
}
