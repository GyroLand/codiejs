"use strict";

module.exports = {
  getBytes: function (num) {
    return new Uint8Array([
           (num & 0x000000ff),
           (num & 0x0000ff00) >> 8
      ]); // Little endian
  }
};
