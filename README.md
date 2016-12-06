SensorData Slack Bot
------------------------------

Slack Bot which gets data from [Sensordata api](https://github.com/ttu/sensordata-node-restapi).

### Tokens, passwords etc.

Give these as environment variables or add keys.js file

keys.js:
```js
'use strict';

module.exports = {
    botToken: 'xxxx',
    homeChannelId: 'xxxx',
    apiUserName: 'xxxx',
    apiPassword: 'xxxx',
    apiUrl: 'xxxx'
};
```