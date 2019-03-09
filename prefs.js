const { Gtk, Gio, GLib, GObject } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Local = ExtensionUtils.getCurrentExtension();
const Convenience = Local.imports.convenience;
const Temp = Local.imports.temp;
const Gettext = imports.gettext.domain(Local.metadata['gettext-domain']);
const _ = Gettext.gettext;

function init()
{
	Convenience.initTranslations();
}

class CastToTvSettings extends Gtk.Grid
{
	constructor()
	{
		super();
		this.margin = 20;
		this.spacing = 30;
		this.row_spacing = 6;
		this._settings = Convenience.getSettings();

		let label = null;
		let widget = null;
		let box = null;
		let button = null;
		let value = null;

		/* Label: General */
		label = new Gtk.Label({
			label: '<b><big>' + _("General") + '</big></b>',
			use_markup: true,
			hexpand: true,
			halign: Gtk.Align.START
		});
		this.attach(label, 0, 0, 1, 1);

		/* FFmpeg Path */
		label = new Gtk.Label({
			label: _("FFmpeg path"),
			hexpand: true,
			halign: Gtk.Align.START,
			margin_left: 12
		});
		widget = new Gtk.Entry({width_request: 220, halign:Gtk.Align.END});
		widget.set_placeholder_text("/usr/bin/ffmpeg");
		this._settings.bind('ffmpeg-path', widget, 'text', Gio.SettingsBindFlags.DEFAULT);
		this.attach(label, 0, 1, 1, 1);
		this.attach(widget, 1, 1, 1, 1);

		/* FFprobe Path */
		label = new Gtk.Label({
			label: _("FFprobe path"),
			hexpand: true,
			halign: Gtk.Align.START,
			margin_left: 12
		});
		widget = new Gtk.Entry({width_request: 220, halign:Gtk.Align.END});
		widget.set_placeholder_text("/usr/bin/ffprobe");
		this._settings.bind('ffprobe-path', widget, 'text', Gio.SettingsBindFlags.DEFAULT);
		this.attach(label, 0, 2, 1, 1);
		this.attach(widget, 1, 2, 1, 1);

		/* Receiver Type */
		label = new Gtk.Label({
			label: _("Receiver type"),
			hexpand: true,
			halign: Gtk.Align.START,
			margin_left: 12
		});
		widget = new Gtk.ComboBoxText({halign:Gtk.Align.END});
		widget.append('chromecast', "Chromecast");
		widget.append('other', _("Other device"));
		this._settings.bind('receiver-type', widget, 'active-id', Gio.SettingsBindFlags.DEFAULT);
		this.attach(label, 0, 3, 1, 1);
		this.attach(widget, 1, 3, 1, 1);
		widget.grab_focus();

		/* Listening Port */
		label = new Gtk.Label({
			label: _("Listening port"),
			hexpand: true,
			halign: Gtk.Align.START,
			margin_left: 12
		});
		widget = new Gtk.SpinButton({halign:Gtk.Align.END});
		widget.set_sensitive(true);
		widget.set_range(1, 65535);
		widget.set_value(this._settings.get_int('listening-port'));
		widget.set_increments(1, 2);
		this._settings.bind('listening-port', widget, 'value', Gio.SettingsBindFlags.DEFAULT);
		this.attach(label, 0, 4, 1, 1);
		this.attach(widget, 1, 4, 1, 1);

		/* Label: Media Encoding */
		label = new Gtk.Label({
			label: '<b><big>' + _("Media Encoding") + '</big></b>',
			use_markup: true,
			hexpand: true,
			margin_top: 20,
			halign: Gtk.Align.START
		});
		this.attach(label, 0, 5, 1, 1);

		/* Video Bitrate */
		label = new Gtk.Label({
			label: _("Bitrate (Mbps)"),
			hexpand: true,
			halign: Gtk.Align.START,
			margin_left: 12
		});
		widget = new Gtk.SpinButton({halign:Gtk.Align.END, digits:1});
		widget.set_sensitive(true);
		widget.set_range(2.0, 10.0);
		widget.set_value(this._settings.get_double('video-bitrate'));
		widget.set_increments(0.1, 0.2);
		this._settings.bind('video-bitrate', widget, 'value', Gio.SettingsBindFlags.DEFAULT);
		this.attach(label, 0, 6, 1, 1);
		this.attach(widget, 1, 6, 1, 1);

		/* Hardware Acceleration */
		label = new Gtk.Label({
			label: _("Hardware acceleration"),
			hexpand: true,
			halign: Gtk.Align.START,
			margin_left: 12
		});
		widget = new Gtk.ComboBoxText({halign:Gtk.Align.END});
		widget.append('none', _("None"));
		/* TRANSLATORS: Should remain as VAAPI unless you use different alphabet */
		widget.append('vaapi', _("VAAPI"));
		//widget.append('nvenc', _("NVENC"));
		this._settings.bind('video-acceleration', widget, 'active-id', Gio.SettingsBindFlags.DEFAULT);
		this.attach(label, 0, 7, 1, 1);
		this.attach(widget, 1, 7, 1, 1);

		/* Label: Chromecast Remote */
		label = new Gtk.Label({
			label: '<b><big>' + _("Chromecast Remote") + '</big></b>',
			use_markup: true,
			hexpand: true,
			margin_top: 20,
			halign: Gtk.Align.START
		});
		this.attach(label, 0, 8, 1, 1);

		/* Remote Position */
		label = new Gtk.Label({
			label: _("Remote position"),
			hexpand: true,
			halign: Gtk.Align.START,
			margin_left: 12
		});
		widget = new Gtk.ComboBoxText({halign:Gtk.Align.END});
		widget.append('left', _("Left"));
		widget.append('center-left', _("Center (left side)"));
		widget.append('center-right', _("Center (right side)"));
		widget.append('right', _("Right"));
		this._settings.bind('remote-position', widget, 'active-id', Gio.SettingsBindFlags.DEFAULT);
		this.attach(label, 0, 9, 1, 1);
		this.attach(widget, 1, 9, 1, 1);

		/* Seek Backward/Forward */
		label = new Gtk.Label({
			label: _("Seek backward/forward (seconds)"),
			hexpand: true,
			halign: Gtk.Align.START,
			margin_left: 12
		});
		widget = new Gtk.SpinButton({halign:Gtk.Align.END});
		widget.set_sensitive(true);
		widget.set_range(1, 120);
		widget.set_value(this._settings.get_int('seek-time'));
		widget.set_increments(1, 2);
		this._settings.bind('seek-time', widget, 'value', Gio.SettingsBindFlags.DEFAULT);
		this.attach(label, 0, 10, 1, 1);
		this.attach(widget, 1, 10, 1, 1);

		/* Label: Miscellaneous */
		label = new Gtk.Label({
			/* TRANSLATORS: The rest  of settings (something like "Other" or "Remaining") */
			label: '<b><big>' + _("Miscellaneous") + '</big></b>',
			use_markup: true,
			hexpand: true,
			margin_top: 20,
			halign: Gtk.Align.START
		});
		this.attach(label, 0, 11, 1, 1);

		/* Music Visualizer */
		label = new Gtk.Label({
			label: _("Music visualizer"),
			hexpand: true,
			halign: Gtk.Align.START,
			margin_left: 12
		});
		widget = new Gtk.Switch({halign:Gtk.Align.END});
		widget.set_sensitive(true);
		widget.set_active(this._settings.get_boolean('music-visualizer'));
		this._settings.bind('music-visualizer', widget, 'active', Gio.SettingsBindFlags.DEFAULT);
		this.attach(label, 0, 12, 1, 1);
		this.attach(widget, 1, 12, 1, 1);

		/* Chromecast device name */
		label = new Gtk.Label({
			label: _("Chromecast selection"),
			hexpand: true,
			halign: Gtk.Align.START,
			margin_left: 12
		});
		box = new Gtk.Box({halign:Gtk.Align.END});
		widget = new Gtk.ComboBoxText();
		button = Gtk.Button.new_from_icon_name('view-refresh-symbolic', 4);
		box.pack_end(button, false, false, 0);
		box.pack_end(widget, false, false, 8);
		setDevices(widget);
		button.connect('clicked', scanDevices.bind(this, widget));
		this._settings.bind('chromecast-name', widget, 'active-id', Gio.SettingsBindFlags.DEFAULT);
		this.attach(label, 0, 13, 1, 1);
		this.attach(box, 1, 13, 1, 1);
	}
}

function scanDevices(widget)
{
	widget.remove_all();

	GLib.spawn_command_line_sync('node' + ' ' + Local.path + '/node_scripts/scanner');

	setDevices(widget);
	widget.set_active(0);
}

function setDevices(widget)
{
	widget.append('', 'Automatic');
	let devices = Temp.readFromFile(Local.path + '/devices.json');

	if(devices)
	{
		devices.forEach(device => widget.append(device.name, device.friendlyName));
	}
}

function buildPrefsWidget()
{
	let widget = new CastToTvSettings();
	widget.show_all();

	return widget;
}
