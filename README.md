Slack Bot
------------------------------

* Get sensordata from [Sensordata API](https://github.com/ttu/sensordata-node-restapi)
* Get restaurant list from [Google Places API](https://developers.google.com/places/web-service/search)

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
    apiUrl: 'xxxx',
    locationApiKey: 'xxxx' 
};
```