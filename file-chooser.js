imports.gi.versions.Gtk = '3.0';

const { Gtk, GLib } = imports.gi;
const ByteArray = imports.byteArray;
const Gettext = imports.gettext;
const MetadataDomain = 'cast-to-tv';
const GettextDomain = Gettext.domain(MetadataDomain);
const _ = GettextDomain.gettext;
const localPath = GLib.get_home_dir() + '/.local/share/gnome-shell/extensions/cast-to-tv@rafostar.github.com';
const streamType = ARGV[0];
imports.searchPath.unshift(localPath);
const Helper = imports.helper;
const shared = imports.shared.module.exports;
imports.searchPath.shift();

let Settings = Helper.getSettings(localPath, 'org.gnome.shell.extensions.cast-to-tv');
Helper.initTranslations(localPath, MetadataDomain);

/* TRANSLATORS: Button text when selected SINGLE file */
const CAST_LABEL_SINGLE = _("Cast Selected File");
/* TRANSLATORS: Button text when selected MULTIPLE files */
const CAST_LABEL_MULTI = _("Cast Selected Files");
const ADD_PLAYLIST_LABEL = _("Add to Playlist");

class fileChooser
{
	constructor()
	{
		GLib.set_prgname('Cast to TV');
		this.application = new Gtk.Application();
		this.application.connect('activate', () => this._openDialog());
		this.application.connect('startup', () => this._buildUI());
		this.application.run([]);
	}

	_buildUI()
	{
		this.window = new Gtk.ApplicationWindow();

		this.fileChooser = new Gtk.FileChooserDialog({
			transient_for: this.window,
			window_position: Gtk.WindowPosition.CENTER
		});

		let iconTheme = Gtk.IconTheme.get_default();
		if(iconTheme.has_icon('cast-to-tv')) this.fileChooser.set_icon_name('cast-to-tv');
		else {
			try { this.fileChooser.set_icon_from_file(localPath + '/appIcon/cast-to-tv.svg'); }
			catch(err) { this.fileChooser.set_icon_name('application-x-executable'); }
		}
	}

	_getTranscodeBox()
	{
		let box = new Gtk.Box({ spacing: 2 });
		this.buttonConvert = new Gtk.CheckButton({ label: _("Transcode:") });

		this.comboBoxConvert = new Gtk.ComboBoxText();
		this.comboBoxConvert.append('video', _("Video"));
		//this.comboBoxConvert.append('audio', _("Audio"));
		this.comboBoxConvert.append('video+audio', _("Video + Audio"));
		this.comboBoxConvert.set_active(0);
		this.comboBoxConvert.set_sensitive(false);

		this.buttonConvert.connect('toggled', () =>
		{
			let isConvertActive = this.buttonConvert.get_active();
			this.comboBoxConvert.set_sensitive(isConvertActive);

			this._checkPlaylistLabel();
		});

		box.pack_start(this.buttonConvert, true, true, 0);
		box.pack_start(this.comboBoxConvert, true, true, 0);
		box.show_all();

		return box;
	}

	_getEncodeTypeString(configContents)
	{
		if(this.comboBoxConvert && this.comboBoxConvert.active_id !== 'audio')
		{
			switch(configContents.videoAcceleration)
			{
				case 'vaapi':
					return '_VAAPI';
				case 'nvenc':
					return '_NVENC';
				default:
					return '_ENCODE';
			}
		}

		return '';
	}

	_getTranscodeAudioEnabled()
	{
		let isTranscodeAudioEnabled = false;

		if(this.comboBoxConvert)
			isTranscodeAudioEnabled = (this.comboBoxConvert.active_id !== 'video') ? true : false;

		return isTranscodeAudioEnabled;
	}

	_openDialog()
	{
		let configContents = this._readFromFile(shared.configPath);
		if(!configContents || !streamType) return;

		let selectionContents = {
			streamType: streamType,
			subsPath: ''
		};

		this.isSubsDialog = false;
		this.fileFilter = new Gtk.FileFilter();

		if(configContents.receiverType == 'other' && selectionContents.streamType == 'PICTURE')
		{
			this.fileChooser.set_select_multiple(false);
		}
		else
		{
			this.fileChooser.set_select_multiple(true);
		}

		this.fileChooser.set_action(Gtk.FileChooserAction.OPEN);
		this.fileChooser.add_button(_("Cancel"), Gtk.ResponseType.CANCEL);

		this.chromecastPlaying = Settings.get_boolean('chromecast-playing');
		this.playlistAllowed = this._getAddPlaylistAllowed();
		this.playlistSignal = Settings.connect('changed::chromecast-playing', () => this._onChromecastPlayingChange());

		let castButtonText = (this.playlistAllowed) ? ADD_PLAYLIST_LABEL : CAST_LABEL_SINGLE;
		this.buttonCast = this.fileChooser.add_button(castButtonText, Gtk.ResponseType.OK);

		switch(selectionContents.streamType)
		{
			case 'VIDEO':
				this.buttonSubs = this.fileChooser.add_button(_("Add Subtitles"), Gtk.ResponseType.APPLY);
				this.fileChooser.set_title(_("Select Video"));
				this.fileChooser.set_current_folder(GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_VIDEOS));
				this.fileChooser.set_extra_widget(this._getTranscodeBox());

				this.fileFilter.set_name(_("Video Files"));
				this.fileFilter.add_mime_type('video/*');

				this.fileSelectionChanged = this.fileChooser.connect('selection-changed', () => this._onVideoSel());
				break;
			case 'MUSIC':
				this.fileChooser.set_title(_("Select Music"));
				this.fileChooser.set_current_folder(GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_MUSIC));

				this.fileFilter.set_name(_("Audio Files"));
				this.fileFilter.add_mime_type('audio/*');

				this.fileSelectionChanged = this.fileChooser.connect('selection-changed', () => this._onMusicAndPicSel());
				break;
			case 'PICTURE':
				this.fileChooser.set_title(_("Select Picture"));
				this.fileChooser.set_current_folder(GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES));

				this.fileFilter.set_name(_("Pictures"));
				this.fileFilter.add_pixbuf_formats();

				this.fileSelectionChanged = this.fileChooser.connect('selection-changed', () => this._onMusicAndPicSel());
				break;
			default:
				return;
		}

		this.fileChooser.add_filter(this.fileFilter);
		this.fileChooser.connect('response', () => this._onResponse());

		let DialogResponse = this.fileChooser.run();

		Settings.disconnect(this.playlistSignal);

		let filesList = this.filePathChosen.sort();
		selectionContents.filePath = filesList[0];

		if(DialogResponse !== Gtk.ResponseType.OK)
		{
			if(DialogResponse === Gtk.ResponseType.APPLY)
			{
				selectionContents.subsPath = this._selectSubtitles();
				if(!selectionContents.subsPath) return;
			}
			else
			{
				return;
			}
		}

		this.fileChooser.disconnect(this.fileSelectionChanged);

		/* Handle convert button */
		if(this.buttonConvert && this.buttonConvert.get_active())
		{
			selectionContents.streamType += this._getEncodeTypeString(configContents);
			selectionContents.transcodeAudio = this._getTranscodeAudioEnabled();
		}
		else
			selectionContents.transcodeAudio = false;

		this.fileChooser.destroy();

		let setTempFiles = () =>
		{
			/* Set playback list */
			GLib.file_set_contents(shared.listPath, JSON.stringify(filesList, null, 1));

			/* Save selection to file */
			GLib.file_set_contents(shared.selectionPath, JSON.stringify(selectionContents, null, 1));
		}

		/* Playlist does not support external subtitles */
		if(this.playlistAllowed)
		{
			let playlist = this._readFromFile(shared.listPath);
			if(!playlist) return setTempFiles();

			filesList.forEach(filepath =>
			{
				if(!playlist.includes(filepath))
					playlist.push(filepath);
			});

			GLib.file_set_contents(shared.listPath, JSON.stringify(playlist, null, 1));
		}
		else
			setTempFiles();
	}

	_selectSubtitles()
	{
		this.isSubsDialog = true;
		this._checkPlaylistLabel();

		let subsFilter = new Gtk.FileFilter();

		this.fileChooser.set_title(_("Select Subtitles"));
		this.buttonSubs.hide();

		/* Add supported subtitles formats to filter */
		subsFilter.set_name(_("Subtitle Files"));

		shared.subsFormats.forEach(function(extension)
		{
			subsFilter.add_pattern('*.' + extension);
		});

		this.fileChooser.set_select_multiple(false);
		this.fileChooser.remove_filter(this.fileFilter);
		this.fileChooser.add_filter(subsFilter);

		if(this.fileChooser.run() == Gtk.ResponseType.OK) return this.filePathChosen[0];
		else return null;
	}

	_readFromFile(path)
	{
		/* Check if file exists (EXISTS = 16) */
		let fileExists = GLib.file_test(path, 16);

		if(fileExists)
		{
			/* Read config data from temp file */
			let [readOk, readFile] = GLib.file_get_contents(path);

			if(readOk)
			{
				let data;

				if(readFile instanceof Uint8Array)
				{
					try { data = JSON.parse(ByteArray.toString(readFile)); }
					catch(err) { data = null; }
				}
				else
				{
					try { data = JSON.parse(readFile); }
					catch(err) { data = null; }
				}

				return data;
			}
		}

		return null;
	}

	_getAddPlaylistAllowed()
	{
		let allowed = false;

		if(this.chromecastPlaying)
		{
			if(this.isSubsDialog || (this.buttonConvert && this.buttonConvert.get_active()))
			{
				allowed = false;
			}
			else
			{
				let preSelection = this._readFromFile(shared.selectionPath);

				if(	preSelection
					&& preSelection.streamType === streamType
					&& !preSelection.transcodeAudio
				)
					allowed = true;
			}
		}

		return allowed;
	}

	_checkPlaylistLabel()
	{
		let allowed = this._getAddPlaylistAllowed();

		if(this.playlistAllowed !== allowed)
		{
			this.playlistAllowed = allowed;

			if(this.playlistAllowed && this.buttonCast)
				this.buttonCast.label = ADD_PLAYLIST_LABEL;
			else
				this.fileChooser.emit('selection-changed');
		}
	}

	_onVideoSel()
	{
		if(this.playlistAllowed) return;

		let selectedNumber = this.fileChooser.get_filenames().length;

		if(selectedNumber > 1)
		{
			this.buttonCast.label = CAST_LABEL_MULTI;
			this.buttonSubs.hide();
		}
		else
		{
			this.buttonCast.label = CAST_LABEL_SINGLE;
			this.buttonSubs.show();
		}
	}

	_onMusicAndPicSel()
	{
		if(this.playlistAllowed) return;

		let selectedNumber = this.fileChooser.get_filenames().length;

		if(selectedNumber > 1) this.buttonCast.label = CAST_LABEL_MULTI;
		else this.buttonCast.label = CAST_LABEL_SINGLE;
	}

	_onResponse()
	{
		this.filePathChosen = this.fileChooser.get_filenames();
	}

	_onChromecastPlayingChange()
	{
		this.chromecastPlaying = Settings.get_boolean('chromecast-playing');
		this._checkPlaylistLabel();
	}
}

let dialog = new fileChooser();
