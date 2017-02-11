Slack Bot
------------------------------

Uses BotKit to handle communication with Slack

## Functionality

#### Get Temperture

Get `/api/data/{id}` from [Sensordata API](https://github.com/ttu/sensordata-node-restapi) for all sensors in the configuration.

```
{"name":"5krs","temperature":21.25,"humidity":23,"noise":47,"light":124}

{"name":"6krs","temperature":22.64,"humidity":23,"noise":45,"light":571}
``` 
#### Anyone at the office

Get `/api/haspeople/{id}` from [Sensordata API](https://github.com/ttu/sensordata-node-restapi) for all sensors in the configuration. If any of the requests return true, then there is someone at the office.

#### Suggest a lunch place 

Get list of restaurants from [Google Places API](https://developers.google.com/places/web-service/search) that are max 500m from the office and return random item from that list. Office location is defined in the configuration.js. 

#### Free meeting rooms & Current events

Uses [Google Calendar API](https://developers.google.com/google-apps/calendar/quickstart/nodejs) to get events. Meeting room calendars are defined in configuration.js.

Execute `npm run create_token` to store authentication token to json-file. This file is not in version control.

Free meeting rooms list rooms that are free and duration how long they are avaialble. Current events lists next 2 events for each calendar defined in the configuration.js.

### ConsoleApp for testing

Console app wraps same functionality as BotKit, so it works with same commands and returns same responsens.

```sh
$ npm run console
```

### Configuration

configuration.js containts tokens, passwords, locations, sensors etc. Some of these can be given also as environment variables

configuration.js:
```js
'use strict';

module.exports = {
    botToken: 'xxxx',
    homeChannelId: 'xxxx',
    apiUserName: 'xxxx',
    apiPassword: 'xxxx',
    apiUrl: 'xxxx',
    locationApiKey: 'xxxx',
    office: { lat: 60.17, lon: 24.94 },
    sensors: [ 
        { id: 'xxx', name: 'xx'},
        { id: 'xxx', name: 'xx'}        
    ],
    meetingRooms: [
        { name: 'xxxx', id: 'xxxx'},
};
```