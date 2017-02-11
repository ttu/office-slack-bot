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

const bot = () => {
    const anyone = ['people', 'anyone', 'any'];
    const temp = ['temp', 'temperature'];
    const lunch = ['lunch', 'lounas'];
    const free = ['free', 'vapaa'];
    const reservations = ['reservations', 'current', 'neukkarit'];

    const hasPeople = () => {
        return api.hasPeople().then(resonse => {
            return resonse ? 'Office has people' : 'Office is empty';
        }).catch(error => {
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
                        light: response.Light
                    };
                    resolve(sensorData);
                }).catch(e => {
                    Console.log(e);
                    // Because Promise.all will fail fast, on error return null
                    resolve(null);
                });
            });
        });

        return Promise.all(promises).then(values => {
            const lines = values
                .filter(e => e !== null)
                .reduce((prev, curr) => {
                    return `${prev}${prev !== '' ? '\n\r' : ''}${JSON.stringify(curr)}`
                }, '');

            // Slack format for code block ```triple backticks```
            return `\`\`\`${lines}\`\`\``;
        });
    };

    const getLunchPlace = () => {
        return restaurants.getRestaurant().then(response => {
            return `How about ${response}`;
        }).catch(errorMessage => errorMessage);
    };

    const getCurrentEvents = () => {
        return calendar.process(2).then(events => {
            return events.reduce((prev, e) => {
                const start = moment(e.start).format('L LT');
                const end = moment(e.end).format('LT');
                return `${prev}${prev !== '' ? '\n\r' : ''}${e.name} - ${start} to ${end} - ${e.summary}`
            }, 'Current reservations:');
        }).catch(errorMessage => errorMessage);
    };

    const getFreeSlotDuration = () => {
        return calendar.process().then(events => {
            return events.reduce((prev, e) => {
                const diff = moment.duration(moment(e.start).diff(moment()));
                const diffAsHours = diff.asHours();
                if (diffAsHours > 0 && diffAsHours < 1) {
                    return `${prev}${prev !== '' ? '\n\r' : ''}${e.name} - ${diff.asMinutes().toFixed(0)} minutes`
                }
                else if (diffAsHours > 0) {
                    return `${prev}${prev !== '' ? '\n\r' : ''}${e.name} - ${diffAsHours.toFixed(1)} hours`
                }
                else {
                    return prev;
                }
            }, 'Free for the next:');
        }).catch(errorMessage => errorMessage);
    };

    return {
        handle(message) {
            const msg = message.toLowerCase();

            if (anyone.some(e => e === msg)) {
                return hasPeople();
            }
            else if (temp.some(e => e === msg)) {
                return temperature();
            }
            else if (lunch.some(e => e === msg)) {
                return getLunchPlace();
            }
            else if (free.some(e => e === msg)) {
                return getFreeSlotDuration();
            }
            else if (reservations.some(e => e === msg)) {
                return getCurrentEvents();
            }
            else if (msg === 'cmd') {
                return Promise.resolve(`\`\`\`anyone: Is there anyone at the office\ntemp: Office temperature\nfree: List free meeting rooms\nreservations: List next meeting room reservations\nlunch: Suggest a lunch place\`\`\``);
            }

            return Promise.resolve("Hello! Write _cmd_ to get commands I know.");
        }
    }
}

module.exports = bot();