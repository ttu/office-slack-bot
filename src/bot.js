'use strict';

const moment = require('moment');
moment.locale('fi');

const SensorApi = require('./sensorApi');
const RestaurantService = require('./restaurantService');
const CalendarService = require('./calendarService');
const Config = require('./configuration');

const API_USERNAME = process.env.API_USERNAME || Config.apiUserName;
const API_PASSWORD = process.env.API_PASSWORD || Config.apiPassword;
const API_URL = process.env.API_URL || Config.apiUrl;
const LOCATION_API_KEY = process.env.LOCATION_API_KEY || Config.locationApiKey;

const api = new SensorApi(API_USERNAME, API_PASSWORD, API_URL, Config.sensors);
const restaurants = new RestaurantService(LOCATION_API_KEY, Config.office);
const calendar = new CalendarService(Config.meetingRooms);

// Bot returns object literal instead of class, so we can have private functions
const bot = () => {
    const anyone = ['people', 'anyone', 'any'];
    const temp = ['temp', 'temperature'];
    const lunch = ['lunch', 'lounas'];
    const free = ['free', 'vapaa'];
    const reservations = ['rooms', 'reservations', 'current', 'neukkarit'];
    const book = ['book'];
    const cancel = ['cancel']; // Cancel reservation

    // Slack format for code block ```triple backticks```
    const outputFormat = (text) => `\`\`\`${text}\`\`\``;

    const hasPeople = () => {
        return api.hasPeople().then(resonse => {
            const text = resonse ? 'Office has people' : 'Office is empty';
            return outputFormat(text);
        }).catch(error => {
            notifyFunc('hasPeople failed: ' + error);
            return 'Service is offline';
        });
    };

    const temperature = () => {
        const promises = Config.sensors.map(s => {
            return new Promise((resolve, reject) => {
                api.temperature(s).then(([sensor, response]) => {
                    const sensorData = {
                        name: sensor.name,
                        temperature: response.Temperature / 100,
                        humidity: response.Humidity,
                        noise: response.Noise,
                        light: response.Light,
                        time: moment(response.MeasurementTime).format('HH:mm DD.MM.')
                    };
                    resolve(sensorData);
                }).catch(errorMessag => {
                    notifyFunc('temperature failed: ' + errorMessag)
                    // Because Promise.all will fail fast, on error return null
                    resolve(null);
                });
            });
        });

        return Promise.all(promises).then(values => {
            const lines = values
                .filter(e => e !== null)
                .reduce((prev, curr) => {
                    return `${prev}${prev !== '' ? '\n' : ''}${JSON.stringify(curr)}`
                }, '');
            return outputFormat(lines);
        });
    };

    const getLunchPlace = () => {
        return restaurants.getRestaurant().then(response => {
            return `How about ${response}?`;
        }).catch(error => {
            notifyFunc('getLunchPlace failed: ' + (error.stack || error));
            return 'Error while fetching lunch places';
        });
    };

    const getCurrentEvents = () => {
        return calendar.getEvents(2).then(events => {
            const eventsText = events.reduce((prev, e) => {
                const start = moment(e.start).format('DD.MM. HH:mm');
                const end = moment(e.end).format('HH:mm');
                return `${prev}${prev !== '' ? '\n' : ''}${e.name} - ${start} to ${end} - ${e.summary}`
            }, 'Next 2 reservations:');
            return outputFormat(eventsText);
        }).catch(error => {
            notifyFunc('getCurrentEvents failed: ' + (error.stack || error));
            return 'Error with current reservations';
        });
    };

    const getFreeSlotDuration = () => {
        // FIXME: Returns 'No free meeting rooms' when no reservations are found
        return calendar.getEvents().then(events => {
            const eventsText = events.reduce((prev, e) => {
                const diff = moment.duration(moment(e.start).diff(moment()));
                const diffAsHours = diff.asHours();
                if (diffAsHours > 0 && diffAsHours < 1) {
                    return `${prev}${prev !== '' ? '\n' : ''}${e.name} - ${diff.asMinutes().toFixed(0)} minutes`
                } else if (diffAsHours > 0) {
                    return `${prev}${prev !== '' ? '\n' : ''}${e.name} - ${diffAsHours.toFixed(1)} hours`
                } else {
                    return prev;
                }
            }, '');
            return outputFormat(eventsText === '' ? 'No free meeting rooms' : 'Free for next:\n' + eventsText);
        }).catch(error => {
            notifyFunc('getFreeSlotDuration failed: ' + (error.stack || error));
            return 'Error with free meeting rooms';
        });
    };

    const bookMeetingRoom = (params, booker) => {
        const room = params[1];

        const timeParams = params.slice(2);
        let duration = 15;
        let start = moment();
        let param;
        for (param of timeParams) {
            const lastThree = param.substr(param.length - 3);
            if(lastThree == "min") {
                // Duration
                const d = parseInt(param.slice(0, -3));
                if(!Number.isInteger(d))
                    return Promise.resolve(`Invalid duration`);
                if (d > 120)
                    return Promise.resolve(`Booking time can't be more than 60 minutes`);
                if (d < 1)
                    return Promise.resolve(`Booking time can't be less than 1 minute`);
                duration = d;
                continue;
            }

            if(param == "now") {
                start = moment();
                continue;
            }

            // moment is smart enough to replace ':'s with '.'s when necessary
            let parsedTime = moment(param, ['H:m', 'HH:m', 'H:mm', 'HH:mm']);
            if(parsedTime.isValid()) {
                // Time
                if(parsedTime.isBefore(start)) {
                    return Promise.resolve(`Cannot book a meeting in the past`);
                }
                start.set({'hour': parsedTime.hour(), 'minute': parsedTime.minute(), 'second': parsedTime.second()});
                continue;
            }

            return Promise.resolve(`Could not infer the meaning of parameter: ${param}`);
        }
        if(!start.isValid())
            return Promise.resolve(`Invalid start date`);

        return calendar.bookEvent(booker, room, start.toDate(), duration).then(result => {
            return result;
        }).catch(error => {
            notifyFunc(`bookMeetingRoom failed: ${params} ` + (error.message || error));
            return 'Error with booking a meeting room - ' + (error.message || error);
        });
    }

    const cancelMeetingRoom = (params, canceller) => {
        const room = params[1];

        return calendar.cancelEvent(canceller, room).then(result => {
            return result;
        }).catch(error => {
            notifyFunc(`cancelMeetingRoom: ${params}` + (error.message || error));
            return 'Error with cancelling a meeting - ' + (error.message || error);
        });
    }

    // default empty notify function
    let notifyFunc = (output) => {};

    return {
        setNotifyFunc(func) {
            notifyFunc = func;
        },
        handle(message, caller) {
            const msg = message.toLowerCase();
            // Allow arbitrary number of arguments
            // Only use the first one for determining the command
            // e.g. `rooms foo bar` will be `rooms`
            const args = msg.split(" ");
            const command = args[0];

            if (anyone.some(e => e === command)) {
                return hasPeople();
            } else if (temp.some(e => e === command)) {
                return temperature();
            } else if (lunch.some(e => e === command)) {
                return getLunchPlace();
            } else if (free.some(e => e === command)) {
                return getFreeSlotDuration();
            } else if (reservations.some(e => e === command)) {
                return getCurrentEvents();
            } else if (book.some(e => e === command)) {
                return bookMeetingRoom(args, caller);
            } else if (cancel.some(e => e === command)) {
                return cancelMeetingRoom(args, caller);
            } else if (command === 'help') {
                const help = `SlackBot usage:
Options:
  anyone     Is there anyone in the office
  temp       Get the office temperature
  free       List free meeting rooms
  rooms      List upcoming meeting room reservations
  book       Book a meeting room (see `help verbose` for more)
  cancel     Cancel a meeting (see `help verbose` for more)
  lunch      Suggest a lunch place
  help       View this message`

                const verbose = `Booking a room:
  book <room> [arguments...]
  Arguments can be:
    - Duration:
      - Default: 15 min
      - Format: __min
      - Has to be more than 1 minute and less than 120 minutes
    - Start time:
      - Default: now
      - Format: hh:mm, hh.mm or 'now'
      - Can't be in the past
  Examples:
    # Book room xxx for 15 minutes starting now
    book xxx
    # Book the same room for 15 minutes starting 13:00
    book xxx 13:00
    # Book for 20 minutes at noon
    book xxx 20min 12:00
    # Note the free order of arguments!

Cancelling a reservation:
  cancel <room>
  This command will cancel the first meeting that meets the following criteria:
    - The reservation was placed by SlackBot
    - The canceller is the same person that booked the room`
                if(args[1] && args[1] == 'verbose')
                    return Promise.resolve(outputFormat(help + "\n\n" + verbose));
                return Promise.resolve(outputFormat(help));
            }

            return Promise.resolve("I didn't understand. See _help_ for usage instructions.");
        }
    }
}

module.exports = bot();
