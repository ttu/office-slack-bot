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

// Bot return object literal instead of class, so we can have private functions
const bot = () => {
    const anyone = ['people', 'anyone', 'any'];
    const temp = ['temp', 'temperature'];
    const lunch = ['lunch', 'lounas'];
    const free = ['free', 'vapaa'];
    const reservations = ['reservations', 'current', 'neukkarit', 'rooms'];
    const book = ['book'];

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
            return `How about ${response}`;
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

    const bookMeetingRoom = (params) => {
        let duration = 15;

        if (params[2] && Number.isInteger(parseInt(params[2]))) {
            const d = parseInt(params[2]);
            if (d > 60)
                return Promise.resolve(`Booking time can't be more than 60 minutes`);
            if (d < 1)
                return Promise.resolve(`Booking time can't be less than 1 minute`);
            duration = d;
        }

        const room = params[1];
        return calendar.bookEvent(room, duration).then(result => {
            return result;
        }).catch(error => {
            notifyFunc(`bookMeetingRoom failed:  ${params}` + (error.message || error));
            return 'Error with booking a meeting room - ' + (error.message || error);
        });
    }

    // default empty notify function
    let notifyFunc = (output) => {};

    return {
        setNotifyFunc(func) {
            notifyFunc = func;
        },
        handle(message) {
            const msg = message.toLowerCase();

            if (anyone.some(e => e === msg)) {
                return hasPeople();
            } else if (temp.some(e => e === msg)) {
                return temperature();
            } else if (lunch.some(e => e === msg)) {
                return getLunchPlace();
            } else if (free.some(e => e === msg)) {
                return getFreeSlotDuration();
            } else if (reservations.some(e => e === msg)) {
                return getCurrentEvents();
            } else if (book.some(e => e === msg.split(" ")[0])) {
                return bookMeetingRoom(msg.split(" "));
            } else if (msg === 'cmd' || msg === 'help') {
                const commands = [
                    'anyone: Is there anyone at the office',
                    'temp | temperature: Office temperature',
                    'free | vapaa: List free meeting rooms',
                    'rooms | reservations: List next meeting room reservations',
                    'book <room name> [duration in minutes (default: 15 min)]: Book a meeting room',
                    'lunch: Suggest a lunch place'
                ];
                return Promise.resolve(outputFormat(commands.join('\n')));
            }

            return Promise.resolve("Hello! Write _cmd_ or _help_ to get commands I know.");
        }
    }
}

module.exports = bot();
