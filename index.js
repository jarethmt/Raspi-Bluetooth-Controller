process.env.DISPLAY = ':0';
process.env.DBUS_SESSION_BUS_ADDRESS = 'unix:path=/run/dbus/system_bus_socket';
const dbus = require('dbus-native');
const fs = require('fs');
const { exec, spawn } = require("child_process");



//First, start streaming Bluez in to Alsa out
spawn("bluealsa-aplay", ["00:00:00:00:00:00"]);
//Shoot off a notification to let the user know the network is up
playRandomTrack('ready');


//Wire up our buttons
const ButtonClass = require('./buttons.js');
var buttons = new ButtonClass();
buttons.on("ready", function() {
  console.log("Buttons on and listening");
});
buttons.on("play-pause", function() {
	togglePlayPause();
});
buttons.start();



var bus = dbus.systemBus();
var connectedDevice = false;
var disconnectBound = false;





function togglePlayPause(){
	bus.getService('org.bluez').getInterface(connectedDevice+'/player0', 'org.bluez.MediaPlayer1', function(err, MP){
		//HEADS UP, if this ever fails to work in the future, check here:
		// https://github.com/sidorares/dbus-native/pull/254/files
		MP.Status ( function(e, propValue){
        		if (e) {
            			console.error ('Could not get play / pause status: ' + e)
        		}
			else{
				if(propValue == "playing"){
					console.log('Pausing Playback');
					MP.Pause();
				}
				else{
					console.log('Playing');
					MP.Play();
				}
			}
    		})
	});
}



function playRandomTrack(type){
	fs.readdir(__dirname+'/sounds/'+type, (err, files) => {
		var file = files[Math.floor(Math.random() * files.length)];
		var soundFile = __dirname+'/sounds/'+type+'/'+file;
		exec('mpg321 -g 30 '+soundFile);
		console.log('Playing '+soundFile);
	});
}

function startBluetoothDiscovery(){
	bus.getService('org.bluez').getInterface('/org/bluez/hci0', 'org.bluez.Adapter1', function(err, Intf){
                Intf.Powered = true;
                Intf.Discoverable = true;
                Intf.Pariable = true;
                console.log('Bluetooth on and pairing');
	});
}

function stopBluetoothDiscovery(){
	bus.getService('org.bluez').getInterface('/org/bluez/hci0', 'org.bluez.Adapter1', function(err, Intf){
                Intf.Discoverable = false;
                Intf.Pairable = false;
                console.log('Shutting down Bluetooth discovery');
        });
}

function connectToDevice(){

}

function bindDisconnectAction(){
if(!disconnectBound){
bus.getService('org.bluez').getInterface(connectedDevice, 'org.freedesktop.DBus.Properties', function(err, properties){
        properties.on('PropertiesChanged', function(device, props){
                var connectStatus = true;
                if(props[0][0] == "Connected"){
                        connectStatus = props[0][1];
                }
                //Check to see if disconnected and run disconnect stuff
                if(connectStatus !== true && connectedDevice){
                        playRandomTrack("disconnect");
                        startBluetoothDiscovery();
			console.log("Device Disconnected: "+connectedDevice);
                        connectedDevice = false;
                }
        });
});
}
disconnectBound = true;
}

startBluetoothDiscovery();

bus.getService('org.bluez').getInterface('/', 'org.freedesktop.DBus.ObjectManager', function(err, objectManager){
	//Wire up any functionality that has to run when devices connect
	objectManager.on('InterfacesAdded', function(interface, props){
		var regex = /^\/org\/bluez\/hci0\/dev_[A-Z0-9_]+\/fd[0-9]+$/;
		if(regex.test(interface) && !connectedDevice){
			for(var i in props){
				if(props[i][0] == "org.bluez.MediaTransport1"){
					var values = props[i][1];
					for(var j in values){
						if(values[j][0] == "Device"){
							var deviceId = values[j][1][1][0];
							playRandomTrack("connect");
							stopBluetoothDiscovery();
							connectedDevice = deviceId;
							bindDisconnectAction();
							console.log("Device Connected: "+deviceId);
						}
					}
				}
			}
		}
	});
});



var agentPath = "/com/jarethmt/bluetooth";
var agent = {
    mode: "NoInputNoOutput",
    exitOnRelease: true,
    Registered: function(err) {
        //console.log('Registered agent', arguments);
    },
    Release: function() {
        console.log('Release', arguments);
    },
    RequestPinCode: function(device) {
        //console.log("RequestPinCode", arguments);
	//console.log('requesting pin code');
    },
    DisplayPinCode: function(device, pincode) {
        //console.log("DisplayPinCode", arguments);
    },
    RequestPasskey: function(device) {
  	//console.log("RequestPasskey", arguments);
	//console.log('requesting pass key');
    },
    DisplayPasskey: function(device, passkey, entered) {
        //console.log("DisplayPasskey", arguments);
    },
    RequestConfirmation: function(device, passkey) {
        console.log("RequestConfirmation", arguments);
    },
    RequestAuthorization: function(device) {
        console.log("RequestAuthorization", arguments);
    },
    AuthorizeService: function(device, uuid) {
       //console.log("AuthorizeService", arguments);
	//connectedDevice = device;
    },
    Cancel: function() {
        //console.log("Cancel", arguments);
    },
};
bus.exportInterface(agent, agentPath, {
        name: 'org.bluez.Agent1',
        methods: {
            Release:                [ '', '' ],
            RequestPinCode:         [ 'o', 's' ],
            DisplayPinCode:         [ 'os', '' ],
            RequestPasskey:         [ 'o', 'u' ],
            DisplayPasskey:         [ 'ouq', '' ],
            RequestConfirmation:    [ 'ou', '' ],
            RequestAuthorization:   [ 'o', '' ],
            AuthorizeService:       [ 'os', '' ],
            Cancel:                 [ '', '' ]
        }
    });
var bluez = bus.getService('org.bluez');
    bluez.getInterface('/org/bluez', 'org.bluez.AgentManager1', function(err, agentmanager) {
       agentmanager.RegisterAgent(agentPath, agent.mode || "NoInputNoOutput", function(err, res) {
           	agentmanager.RequestDefaultAgent(agentPath, function(data, data2){
			//console.log('testing');
			//console.log(data);
			//console.log(data2);
		});
        });
    });

