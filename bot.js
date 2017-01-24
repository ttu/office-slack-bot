'use strict';

const SensorApi = require('./sensorApi');
const RestaurantService = require('./restaurantService');
const Config = require('./config.js');

const API_USERNAME = process.env.API_USERNAME || require('./keys').apiUserName;
const API_PASSWORD = process.env.API_PASSWORD || require('./keys').apiPassword;
const API_URL = process.env.API_URL || require('./keys').apiUrl;
const LOCATION_API_KEY = process.env.LOCATION_API_KEY || require('./keys').locationApiKey;

const api = new SensorApi(API_USERNAME, API_PASSWORD, API_URL, Config.sensors);
const restaurants = new RestaurantService(LOCATION_API_KEY, Config.office);

const bot = () => {
    const anyone = ['people', 'anyone', 'any'];
    const temp = ['temp', 'temperature'];
    const lunch = ['lunch', 'lounas'];

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
            else if (msg === 'cmd') {
                return Promise.resolve(`\`\`\`anyone: Is there anyone at the office\ntemp: Office temperature\nlunch: Suggest a lunch place\`\`\``);
            }

            return Promise.resolve("Hello! Write _cmd_ to get commands I know.");
        }
    }
}

module.exports = bot();