# codiejs

**Disclaimer**: This library is implemented to work with a specific version of the codie robots, that don't use the routing parameter. If you have a robot that doesn't work with this, feel free to submit an issue on GitHub. I'll contact you for further details and we'll try to add support for that as well. Let's make it a ***true community project***!

A Node.js module to control a Codie robot. This module was written originally for a [codie-server component](https://github.com/zbettenbuk/codie-server)  that allows a Codie to be controlled remotely or use them in apps like Skratch(X), but generalized enough to use it in other custom apps.

## License

This module is licensed under [AGPL](https://tldrlegal.com/license/gnu-affero-general-public-license-v3-(agpl-3.0)), please take this into consideration when re-using.

## Usage

### Requirements

This module uses [noble](https://github.com/sandeepmistry/noble) to communicate over bluetooth, and noble has some heavy requirements. Setting up on a mac is fairly easy, you only need xcode, and node-gyp, but on Windows it' a whole different story. Please see noble's documentation for more info.

### Installation

```sh
npm install codiejs
```
### API

#### Connect

```javascript
var codie = new Codie("Codie_001"); // pass your codie's name to the constructor
codie.connect(function (error) {
    if (!error) {
        // do something with codie
    }
});
```

#### Commands

##### Move
```javascript
codie.move (distance, leftSpeed, rightSpeed, cb);
```

##### Enable motors
```javascript
codie.enableMotorBoth (leftSpeed, rightSpeed, cb);
```

##### Enable left motor
```javascript
codie.enableMotorLeft (speed, cb);
```

##### Enable right motor
```javascript
codie.enableMotorRight (speed, cb);
```

##### Turn
Note:
- positive speed -> left turn
- negative speed -> right turn
```javascript
codie.turn (angle, speed, cb);
```

##### Beep
```javascript
codie.beep (volume, frequency, duration, cb);
```

##### Set led colour
```javascript
codie.setColor (hue, saturation, value, cb);
```

##### Start animation
Possible animation values: 0, 1
```javascript
codie.setAnimation (animation, hue, saturation, repeat, speed, cb);
```

#### Sensors

##### Distance
```javascript
codie.getDistance (cb(sensorData));
```

##### Battery
```javascript
codie.getBattery (cb(sensorData));
```

##### Sound
```javascript
codie.getSound (cb(sensorData));
```

##### Light
```javascript
codie.getLight (cb(sensorData));
```

##### Line
```javascript
codie.getLine (cb(sensorData));
```
