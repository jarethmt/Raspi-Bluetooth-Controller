const Gpio = require('onoff').Gpio;
const util = require("util");
const  EventEmitter = require('events').EventEmitter;
var Buttons = function() { }
util.inherits(Buttons, EventEmitter);
Buttons.prototype.start = function() {
	var that = this;
	this.emit('ready');
	const playButton = new Gpio(17, 'in', 'both');
	playButton.watch(function(err, value){
		if(value){
        		that.emit("play-pause");
		}
	});
};

module.exports = Buttons;
