const St = imports.gi.St;
const GObject = imports.gi.GObject;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const Lang = imports.lang;

const PopupBase = new Lang.Class({
	Name: "PopupBase",
	Extends: PopupMenu.PopupBaseMenuItem,

	_init: function() {
		this.parent({hover: false, reactive: true});
		this.actor.add_style_pseudo_class = function() {return null;};
	},
});

const MediaControlButton = GObject.registerClass({
	GTypeName: 'MediaControlButton'
}, class MediaControlButton extends St.Button {
	_init(buttonIconName, toggle)
	{
		super._init({
			style: 'padding: 4px, 6px, 4px, 6px; margin-left: 2px; margin-right: 2px;',
			opacity: 130,
			child: new St.Icon({
				icon_name: buttonIconName,
				icon_size: 20
			})
		});

		this._turnedOn = false;

		let callback = () => {
			if(!this._turnedOn) this.opacity = !this.reactive ? 30 : this.hover ? 255 : 130;
			else this.opacity = 255;
		};

		let changeState = () => {
			if(toggle)
			{
				this._turnedOn = !this._turnedOn;
				if(this._turnedOn) this.opacity = 255;
				else this.opacity = 130;
			}
		};

		let signalIds = [
			this.connect('notify::hover', callback),
			this.connect('notify::reactive', callback),
			this.connect('clicked', changeState),
			this.connect('destroy', () => {
				signalIds.forEach(signalId => this.disconnect(signalId));
				this._turnedOn = null;
			})
		];
	}

	get turnedOn()
	{
		return this._turnedOn;
	}
});

const SliderItem = new Lang.Class({
	Name: "SliderItem",
	Extends: PopupMenu.PopupBaseMenuItem,

	_init: function(icon) {
		this.parent({hover: false, reactive: true});
		this._icon = new St.Icon({style_class: 'popup-menu-icon', icon_name: icon});
		this._slider = new Slider.Slider(0);

		this.actor.add(this._icon);
		this.actor.add(this._slider.actor, {expand: true});
		this.actor.add_style_pseudo_class = function(){return null;};
	},

	get value()
	{
		return this._slider.value;
	},

	set icon(value)
	{
		this._icon.icon_name = value;
	},

	setValue: function(value)
	{
		this._slider.setValue(value);
	},

	hide: function()
	{
		this.actor.hide();
	},

	show: function()
	{
		this.actor.show();
	},

	connect: function(signal, callback)
	{
		this._slider.connect(signal, callback);
	}
});
