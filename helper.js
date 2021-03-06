/*
Convenience replacement
Original convenience.js does not work correctly with this extension use-cases
*/

const { Gio, GLib } = imports.gi;
const ByteArray = imports.byteArray;
const Gettext = imports.gettext;

function getSettings(localPath, schemaName)
{
	if(!localPath) return null;

	schemaName = schemaName || 'org.gnome.shell.extensions.cast-to-tv';

	const GioSSS = Gio.SettingsSchemaSource;
	let schemaDir = Gio.File.new_for_path(localPath).get_child('schemas');
	let schemaSource = null;

	if(schemaDir.query_exists(null))
		schemaSource = GioSSS.new_from_directory(
			localPath + '/schemas', GioSSS.get_default(), false
		);
	else
		schemaSource = GioSSS.get_default();

	let schemaObj = schemaSource.lookup(schemaName, true);
	if(!schemaObj)
		throw new Error('Cast to TV: extension schemas could not be found!');

	return new Gio.Settings({ settings_schema: schemaObj });
}

function initTranslations(localPath, gettextDomain)
{
	gettextDomain = gettextDomain || 'cast-to-tv';

	if(localPath)
	{
		let localeDir = Gio.File.new_for_path(localPath).get_child('locale');

		if(localeDir.query_exists(null))
			Gettext.bindtextdomain(gettextDomain, localPath + '/locale');
		else
			Gettext.bindtextdomain(gettextDomain, '/usr/share/locale');
	}
}

function closeOtherApps(mainPath, totalKill)
{
	let extPath = mainPath.substring(0, mainPath.lastIndexOf('/'));
	let addKill = (totalKill) ? '' : '/file-chooser';

	/* Close other possible opened extension windows */
	GLib.spawn_command_line_async('pkill -SIGINT -f ' + mainPath + addKill + '|' +
		extPath + '/cast-to-tv-.*-addon@.*/app');
}

function startApp(appPath, appName, args)
{
	appName = appName || 'app';
	let spawnArgs = ['/usr/bin/gjs', appPath + '/' + appName + '.js'];

	if(args && Array.isArray(args))
		args.forEach(arg => spawnArgs.push(arg));

	/* To not freeze gnome shell app needs to be run as separate process */
	GLib.spawn_async(appPath, spawnArgs, null, 0, null);
}

function setDevicesWidget(widget, devices, activeText)
{
	if(Array.isArray(devices))
	{
		let foundActive = false;
		let appendIndex = 0;
		let appendArray = [];

		devices.forEach(device =>
		{
			if(typeof device === 'object')
			{
				let value = (device.name) ? device.name : null;
				let text = (device.friendlyName) ? device.friendlyName : null;

				if(value && text && !appendArray.includes(value))
				{
					if(!device.name.endsWith('.local') && !device.ip)
						return;

					widget.append(value, text);
					appendArray.push(value);
					appendIndex++;

					if(!foundActive && activeText && activeText === text)
					{
						widget.set_active(appendIndex);
						foundActive = true;
					}
				}
			}
			else
			{
				widget.append(device, device);
				appendIndex++;

				if(!foundActive && activeText && activeText === device)
				{
					widget.set_active(appendIndex);
					foundActive = true;
				}
			}
		});

		if(activeText && !foundActive)
			widget.set_active(0);

		return;
	}

	widget.set_active(0);
}

function readFromFile(path)
{
	let fileExists = GLib.file_test(path, GLib.FileTest.EXISTS);

	if(fileExists)
	{
		let [success, contents] = GLib.file_get_contents(path);

		if(success)
		{
			if(contents instanceof Uint8Array)
			{
				try { contents = JSON.parse(ByteArray.toString(contents)); }
				catch(err) { contents = null; }
			}
			else
			{
				try { contents = JSON.parse(contents); }
				catch(err) { contents = null; }
			}

			return contents;
		}
	}

	return null;
}

function readFromFileAsync(file, callback)
{
	/* Either filepath or Gio.File can be used */
	if(file && typeof file === 'string')
		file = Gio.file_new_for_path(file);

	file.load_contents_async(null, (file, res) =>
	{
		let success, contents;

		try {
			[success, contents] = file.load_contents_finish(res);

			if(success)
			{
				if(contents instanceof Uint8Array)
					contents = JSON.parse(ByteArray.toString(contents));
				else
					contents = JSON.parse(contents);
			}
			else
				contents = null;
		}
		catch(err) {
			contents = null;
		}

		callback(contents);
	});
}

function writeToFile(path, contents)
{
	GLib.file_set_contents(path, JSON.stringify(contents, null, 1));
}

function readOutputAsync(stream, callback)
{
	stream.read_line_async(GLib.PRIORITY_LOW, null, (source, res) =>
	{
		let out_fd, length, outStr;

		[out_fd, length] = source.read_line_finish(res);

		if(out_fd !== null)
		{
			if(out_fd instanceof Uint8Array)
				outStr = ByteArray.toString(out_fd);
			else
				outStr = out_fd.toString();

			callback(outStr);
			readOutputAsync(source, callback);
		}
	});
}

function createDir(dirPath, permissions)
{
	permissions = permissions || 448 // 700 in octal

	let dirExists = GLib.file_test(dirPath, GLib.FileTest.EXISTS);

	if(!dirExists)
		GLib.mkdir_with_parents(dirPath, permissions);
}
