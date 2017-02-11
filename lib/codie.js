"use strict";

const Buffer = require("buffer").Buffer;
const Utils = require("./utils");
var config = require("./config.json");
const BLEClient = require("./bleclient");

function Codie (name, cfg) {
  this.name = name;
  this.seq = 0;
  if (cfg) {
    config = cfg;
  }
}

Codie.prototype.connect = function (cb) {
  var self = this;
  this.bleClient = new BLEClient(this.name, function (peripheral) {
    if (!self.peripheral && peripheral) {
      console.log("Codie found:", self.name);
      self.peripheral = peripheral;
      self.initServices(cb);
    }
  });
};

Codie.prototype.initServices = function (cb) {
  var self = this;
  this.peripheral.connect(function (error) {
    if (error) {
      return cb(error);
    }
    self.peripheral.discoverServices(config.ble.codieUUID, function(error, services) {
      if (error) {
        return cb(error);
      }
      if (!services[0]) {
        console.log("Can't find service", self.serviceUuid);
        return cb("Can't find service", self.serviceUuid);
      }
      services[0].discoverCharacteristics([], function (err, characteristics) {
        for (var characteristicsIndex = 0; characteristicsIndex < characteristics.length; characteristicsIndex++) {
          var characteristic = characteristics[characteristicsIndex];
          switch (characteristic.uuid) {
            case config.ble.rxCharacteristicUUID:
              self.rxService = characteristic;
              break;
            case config.ble.txCharacteristicUUID:
              characteristic.on("data", function (data, isNotification) {
                self.handleReply(data, isNotification);
              });
              characteristic.subscribe(function (error) {
                if (error) {
                  console.log("Error subscribing for response characteristic");
                } else {
                  console.log("Response characteristic connected");
                }
              });
              break;
            default:
              console.log("Unidentified characteristic found", characteristics[characteristicsIndex].uuid);
              break;
          }
        }
      });
      cb();
    });
  });
};

Codie.prototype.handleReply = function(data, isNotification) {
  if (typeof this.registeredReplyCallback === "function") {
    console.log("Codie response: " + data.toString('hex'));
    this.registeredReplyCallback(data);
    delete this.registeredReplyCallback;
  }
};

Codie.prototype.sendCommand = function (cmdArray, paramsArray, cb) {
  this.registeredReplyCallback = cb;
  this.sendMessage(this.rxService, cmdArray, paramsArray);
};

Codie.prototype.sendQuery = function (queryArray, cb) {
  this.registeredReplyCallback = cb;
  this.sendMessage(this.rxService, queryArray);
};

Codie.prototype.sendMessage = function (service, messageArray, paramsArray) {
  var message = Buffer.alloc(7 + (paramsArray ? paramsArray.length : 0));
  message.writeUInt8(0x40,0)
  // seq
  var sequence = Utils.getBytes(this.seq++);
  message.writeUInt8(sequence[0], 1);
  message.writeUInt8(sequence[1], 2);

  // cmd
  message.writeUInt8(messageArray[0], 3);
  message.writeUInt8(messageArray[1], 4);
  message.writeUInt8(messageArray[2], 5);
  message.writeUInt8(messageArray[3], 6);

  for (var paramIndex = 0; paramsArray && paramIndex < paramsArray.length; paramIndex++) {
    message.writeUInt8(paramsArray[paramIndex], 7 + paramIndex);
  }
  //console.log(message)
  service.write(message, false);
};

/*
  ---------------------------- CODIE COMMANDS --------------------------
*/

/*
CODIE COMMAND REFERENCE
The arguments are written in the following form: argName[i8](%). In the square brakets there is the bit count of the argument, prefixed by i as integer or u as unsigned integer. In the normal brackets you can find the dimension of the value represented by the argument. 
ReARG Depicts the arguments which are sent by Codie in the reply packet argument (after the reply-SEQ).
Busy call behavior: At most of the commands, the behavior when Codie still executing a command and there is a new, identical command call, is described.
*/

/*
EchoID: 0x0001
ARGS: none 
The echo command simply requests an echo. Each node should reply with a packet with:
swapped ROUTE
same PRIO
MSB set in command ID
ARGLEN=0
*/
Codie.prototype.echo = function () {
  this.sendCommand([0x01, 0x00]);
};

/*
DriveSpeed
ID: 0x1060
ARG: speedLeft[i8](%), speedRight[i8](%)
ReARG: nSuccessful[u8]Set motor speeds to the given value in percents (0-100%). Speed values are signed, negative value means backwards.
Replies: nSuccessful: 0 means command has been successfully executed, any other value means error.
Busy call behavior: execution ends immediately, the command is nacked, and then the new command starts executing.
*/
Codie.prototype.speed = function (leftSpeed, rightSpeed, cb) {
  this.sendCommand([0x60, 0x10, 0x02, 0x00], [Utils.getBytes(leftSpeed)[0], Utils.getBytes(rightSpeed)[0]], cb);
};

/*
DriveDistance
ID: 0x1061
ARG: distance[u16](mm), speedLeft[i8](%), speedRight[i8](%)
ReARG: nSuccessful[u8]
Move a specified amount of distance (in mm) with given speeds (in percentage 0-100%). Moving backwards can be done with negative speeds.
Currently both of Codie’s tracks will travel the given distance, so covering arcs by specifying different speeds will not yield results as intended… Later we probably will improve this behavior so that distance will mean the length of trajectory of the center of the robot while following an arc.
Replies: nSuccessful, 0 means command has been successfully executed, any other value means error.
Busy call behavior: execution ends immediately, the command is nacked, and then the new command starts executing.
*/
Codie.prototype.move = function (distance, leftSpeed, rightSpeed, cb) {
  var distanceBytes = Utils.getBytes(distance);
  this.sendCommand([0x61, 0x10, 0x04, 0x00], [distanceBytes[0], distanceBytes[1], Utils.getBytes(leftSpeed)[0], Utils.getBytes(rightSpeed)[0]], cb);
};


/*
DriveTurn
ID: 0x1062
ARG: degree[u16](°), speed[i8](%)
ReARG: nSuccessful[u8]
This command makes the robot turn given degrees in one place, by starting the tracks in different directions with given speed. Pozitive speeds turns left, negative speed turns right.
Replies: nSuccessful: 0 means command has been successfully executed, any other value means error.
Busy call behavior: execution ends immediately, the command is nacked, and then the new command starts executing.
*/
Codie.prototype.turn = function (angle, speed, cb) {
  var angleBytes = Utils.getBytes(angle);
  this.sendCommand([0x62, 0x10, 0x03, 0x00], [angleBytes[0], angleBytes[1], Utils.getBytes(speed)[0]], cb);
};

/*
SpeakBeep
ID: 0x1064
ARG: duration[u16](ms)
ReARG: nSuccessful[u8]
Play a beep on the speaker. The frequency is fixed, you can only specify the duration in milliseconds.
Replies: nSuccessful: 0 means command has been successfully executed, any other value means error.
Busy call behavior: execution ends immediately, the command is nacked, and then the new command starts executing.
*/
Codie.prototype.beep = function (duration, cb) {
  var durationBytes = Utils.getBytes(duration);
  this.sendCommand([0x64, 0x10, 0x02, 0x00], [durationBytes[0], durationBytes[1]], cb);
};

/*
LedSetColor
ID: 0x1065
ARG: ledMask[u16], hue[u8], saturation[u8], value[u8]
ReARG: nSuccessful[u8]Set the color of the LEDs. 
The first (least significant) 12 bits of LedMask is a binary mask of which of the 12 pieces of LEDs to change. Where the bit is set, then the color of the corresponding LED whill change to the given HSV value. Hue, saturation and value values are given on a full 8bit range of 0-255.
Replies: nSuccessful: 0 means command has been successfully executed, any other value means error.
*/
//TODO: Masks
Codie.prototype.setColor = function (hue, saturation, value, cb) {
  var hueBytes = Utils.getBytes(Math.floor(hue*0.7));
  var saturationBytes = Utils.getBytes(Math.floor(saturation * 2.55));
  var valueBytes = Utils.getBytes(Math.floor(value * 2.55));
  this.sendCommand([0x65, 0x10, 0x05, 0x00], [0xFF, 0xFF, hueBytes[0], saturationBytes[0], valueBytes[0]], cb);
};


/*
  ----------------------------- CODIE SENSORS ------------------------------
*/

/*
SonarGetRange
ID: 0x1063
ARG: none
ReARG: range[u16](mm)
Request a range measurement with the sonar sensor. The measurement takes time (depends on how far there is a surface in front of Codie), from ~10ms up to 60ms.
Replies: range: the measured distance by the sonar in mm. 0 means error.
Busy call behavior: requests are queued, however you should NOT request a measurement until the reply arrives for the previous request, because the command queue might get jammed.
*/
Codie.prototype.getDistance = function (cb) {
  this.sendQuery([0x63, 0x10], function (data) {
    var sensorData = data.readIntLE(9, 2);
    console.log("Distance sensor:", sensorData);
    cb(sensorData);
  });
};

/*
BatteryGetSoc
ID: 0x1069
ARG: none
ReARG: stateOfCharge[u8](%)
Get the state of charge of the battery in percentage 0-100%.
Replies: stateOfCharge: 0-100% the state of charge of the battery.
*/
Codie.prototype.getBattery = function (cb) {
  this.sendQuery([0x69, 0x10], function (data) {
    var sensorData = data.readIntLE(9, 1);
    var normalizedValue = (sensorData > 100 ? 100 : sensorData);
    console.log("Battery sensor:", sensorData);
    cb(normalizedValue);
  });
};

/*
MicGetRaw
ID: 0x106c
ARG: none
ReARG: value[u16]
Get a reading from the microphone.
Replies: value: Raw value ranging from 0 to about 2048. Several measurements are averaged into one value, the window of averaging is about 50ms.
*/
Codie.prototype.getSound = function (cb) {
  this.sendQuery([0x6c, 0x10], function (data) {
    var sensorData = data.readIntLE(9, 2);
    var normalizedValue = sensorData / 20;
    console.log("Sound sensor:", sensorData);
    cb(normalizedValue);
  });
};

/*
LightSenseGetRaw
ID: 0x106a
ARG: none
ReARG: lightValue[u16]
Get a reading from the light sensor.
Replies: lightValue: A raw reading from the light sensor. The value is measured by ADC on 12 bits, so this can be 0-4096, 0 meaining the brightest and 4095 the darkest light.
*/
Codie.prototype.getLight = function (cb) {
  this.sendQuery([0x6a, 0x10], function (data) {
    var sensorData = data.readIntLE(9, 2);
    var normalizedValue = Math.round(Math.min((4096 - sensorData) / 40.96, 100));
    console.log("Light sensor:", sensorData);
    cb(normalizedValue);
  });
};

/*
LineGetRaw
ID: 0x106b
ARG: none
ReARG: valueLeft[u16], valueRight[u16]Get a reading from the line sensor. The line sensors on the bottom of Codie are simple infrared reflective optical sensors.
Replies: valueLeft, valueRight: Raw 12bit values from the ADC.
*/
Codie.prototype.getLine = function (cb) {
  this.sendQuery([0x6b, 0x10], function (data) {
    var sensorData = data.readIntLE(9, 4);
    var rawValue = Math.round(sensorData / (1024 * 1024));
    var normalizedValue = rawValue > config.lineThreshold;
    console.log("Line sensor:", normalizedValue, "(", rawValue, ")");
    cb(normalizedValue);
  });
};

module.exports = Codie;
