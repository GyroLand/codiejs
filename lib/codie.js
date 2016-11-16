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
    if (peripheral) {
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
    self.peripheral.discoverServices([config.ble.codieUUID], function(error, services) {
      if (error) {
        return cb(error);
      }
      if (!services[0]) {
        return cb("Can't find service", self.serviceUuid);
      }
      services[0].discoverCharacteristics([config.ble.actionCharacteristicUUID, config.ble.actionReplyCharacteristicUUID, config.ble.requestCharacteristicUUID, config.ble.requestReplyCharacteristicUUID], function (err, characteristics) {
        for (var characteristicsIndex = 0; characteristicsIndex < characteristics.length; characteristicsIndex++) {
          var characteristic = characteristics[characteristicsIndex];
          switch (characteristic.uuid) {
            case config.ble.requestCharacteristicUUID:
              // [ 'writeWithoutResponse', 'write' ]
              console.log("Request characteristic connected");
              self.requestService = characteristic;
              break;
            case config.ble.actionCharacteristicUUID:
              // [ 'writeWithoutResponse', 'write' ]
              console.log("Action characteristic connected");
              self.actionService = characteristic;
              break;
            case config.ble.actionReplyCharacteristicUUID:
              // [ 'indicate' ]
              console.log("Action reply characteristic connected");
              characteristic.on("data", function (data, isNotification) {
                self.handleActionReply(data, isNotification);
              });
              characteristic.subscribe(function (error) {
                if (error) {
                  console.log("Error subscribing for action reply characteristic");
                } else {
                  console.log("Action reply characteristic connected");
                }
              });
              break;
            case config.ble.requestReplyCharacteristicUUID:
              // [ 'read', 'indicate' ]
              characteristic.on("data", function (data, isNotification) {
                self.handleRequestReply(data, isNotification);
              });
              characteristic.subscribe(function (error) {
                if (error) {
                  console.log("Error subscribing for request reply characteristic");
                } else {
                  console.log("Request reply characteristic connected");
                }
              });
              break;
            default:
              console.log("Unidentified characteristic found", characteristics[characteristicsIndex].uuid);
              break;
          }
        }
        if (self.requestService && self.actionService) {
          cb();
        } else {
          cb("Error discovering required characteristics");
        }
      });
    });
  });
};

Codie.prototype.handleRequestReply = function(data, isNotification) {
  if (typeof this.registeredRequestReplyCallback === "function") {
    var sensorData = data.readIntLE(2, data.length - 2);
    this.registeredRequestReplyCallback(sensorData);
    delete this.registeredRequestReplyCallback;
  }
};

Codie.prototype.handleActionReply = function(data, isNotification) {
  if (typeof this.registeredActionReplyCallback === "function") {

    this.registeredActionReplyCallback(data);
    delete this.registeredActionReplyCallback;
  }
};

Codie.prototype.sendCommand = function (cmdArray, paramsArray, cb) {
  this.registeredActionReplyCallback = cb;
  this.sendMessage(this.actionService, cmdArray, paramsArray);
};

Codie.prototype.sendQuery = function (queryArray, cb) {
  this.registeredRequestReplyCallback = cb;
  this.sendMessage(this.requestService, queryArray);
};

Codie.prototype.sendMessage = function (service, messageArray, paramsArray) {
  var message = Buffer.alloc(4 + (paramsArray ? paramsArray.length : 0));
  // seq
  var sequence = Utils.getBytes(this.seq++);
  message.writeUInt8(sequence[0], 0);
  message.writeUInt8(sequence[1], 1);

  // cmd
  message.writeUInt8(messageArray[0], 2);
  message.writeUInt8(messageArray[1], 3);

  for (var paramIndex = 0; paramsArray && paramIndex < paramsArray.length; paramIndex++) {
    message.writeUInt8(paramsArray[paramIndex], 4 + paramIndex);
  }

  service.write(message, false);
};

/*
  ---------------------------- CODIE COMMANDS --------------------------
*/

Codie.prototype.move = function (distance, leftSpeed, rightSpeed, cb) {
  var distanceBytes = Utils.getBytes(distance);
  this.sendCommand([0x01, 0x00], [distanceBytes[0], distanceBytes[1], Utils.getBytes(leftSpeed)[0], Utils.getBytes(rightSpeed)[0]], cb);
};

Codie.prototype.enableMotorBoth = function (leftSpeed, rightSpeed, cb) {
  this.sendCommand([0x02, 0x00], [Utils.getBytes(leftSpeed)[0], Utils.getBytes(rightSpeed)[0]], cb);
};

Codie.prototype.enableMotorLeft = function (speed, cb) {
  this.sendCommand([0x03, 0x00], [Utils.getBytes(speed)[0]], cb);
};

Codie.prototype.enableMotorRight = function (speed, cb) {
  this.sendCommand([0x04, 0x00], [Utils.getBytes(speed)[0]], cb);
};

Codie.prototype.turn = function (angle, speed, cb) {
  var angleBytes = Utils.getBytes(angle);
  this.sendCommand([0x05, 0x00], [angleBytes[0], angleBytes[1], Utils.getBytes(speed)[0]], cb);
};

Codie.prototype.beep = function (volume, frequency, duration, cb) {
  var frequencyBytes = Utils.getBytes(frequency);
  var durationBytes = Utils.getBytes(duration);
  this.sendCommand([0x06, 0x00], [Utils.getBytes(volume)[0], frequencyBytes[0], frequencyBytes[1], durationBytes[0], durationBytes[1]], cb);
};

Codie.prototype.setColor = function (hue, saturation, value, cb) {
  var hueBytes = Utils.getBytes(Math.floor(hue * 0.7));
  var saturationBytes = Utils.getBytes(Math.floor(saturation * 2.55));
  var valueBytes = Utils.getBytes(Math.floor(value * 2.55));
  this.sendCommand([0x08, 0x00], [hueBytes[0], saturationBytes[0], valueBytes[0]], cb);
};

/*
  Possible animation values: 0, 1
*/
Codie.prototype.setAnimation = function (animation, hue, saturation, repeat, speed, cb) {
  this.sendCommand([0x09, 0x00], [Utils.getBytes(animation)[0], Utils.getBytes(hue)[0], Utils.getBytes(saturation)[0], Utils.getBytes(repeat)[0], Utils.getBytes(speed)[0]], cb);
};

/*
  ----------------------------- CODIE SENSORS ------------------------------
*/

Codie.prototype.getDistance = function (cb) {
  this.sendQuery([0x01, 0x00], function (data) {
    var normalizedValue = Math.round(data / 10);
    console.log("Distance sensor:", normalizedValue);
    cb(normalizedValue);
  });
};

Codie.prototype.getBattery = function (cb) {
  this.sendQuery([0x02, 0x00], function (data) {
    var normalizedValue = (data > 100 ? 100 : data);
    console.log("Battery sensor:", normalizedValue);
    cb(normalizedValue);
  });
};

Codie.prototype.getSound = function (cb) {
  this.sendQuery([0x03, 0x00], function (data) {
    var normalizedValue = data / 20;
    console.log("Sound sensor:", normalizedValue);
    cb(normalizedValue);
  });
};

Codie.prototype.getLight = function (cb) {
  this.sendQuery([0x04, 0x00], function (data) {
    var normalizedValue = Math.round(Math.min((4096 - data) / 40.96, 100));
    console.log("Light sensor:", normalizedValue);
    cb(normalizedValue);
  });
};

Codie.prototype.getLine = function (cb) {
  this.sendQuery([0x05, 0x00], function (data) {
    var rawValue = Math.round(data / (1024 * 1024));
    var normalizedValue = rawValue > config.lineThreshold;
    console.log("Line sensor:", normalizedValue, "(", rawValue, ")");
    cb(normalizedValue);
  });
};

module.exports = Codie;
