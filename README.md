Slack Bot
------------------------------

Uses BotKit to handle communication with Slack

## Functionality

#### Get Temperture

Get /api/data/{id} from [Sensordata API](https://github.com/ttu/sensordata-node-restapi) for all sensors in the configuration.

```
{"name":"5krs","temperature":21.25,"humidity":23,"noise":47,"light":124}

{"name":"6krs","temperature":22.64,"humidity":23,"noise":45,"light":571}
``` 
#### Anyone at the office

Get /api/haspeople/{id} from [Sensordata API](https://github.com/ttu/sensordata-node-restapi) for all sensors in the configuration. If any of requests return true, then there is someone at the office.

#### Suggest a lunch place 

Get list of restaurants from [Google Places API](https://developers.google.com/places/web-service/search) that are max 500m from the office and return random item from that list.

Office location is defined in the config.js. 

### ConsoleApp for testing

Console app wraps same functionality as BotKit, so it works with same commands and returs same responsens.

```sh
$ npm run console
```

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