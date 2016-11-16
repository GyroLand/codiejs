"use strict";

function BLEClient(codieName, cb) {
  // load here to avoid timing issues
  var noble = require('noble');

  noble.on('stateChange', function(state) {
    console.log("BLE state", state);

    if (state === "poweredOn") {

      noble.startScanning([], true, function (error) {
        if (error) {
          console.log("Start scan error", error);
        } else {
          console.log("Scan started");
        }
      });
    }
  });

  noble.on("discover", function (peripheral) {
    if (peripheral.advertisement && peripheral.advertisement.localName &&
      peripheral.advertisement.localName.toLowerCase() === codieName.toLowerCase()) {
        cb(peripheral);
        noble.stopScanning();
    }
  });
}

module.exports = BLEClient;
