'use strict';

const SensorApi = require('./sensorApi');
const RestaurantService = require('./restaurantService');

const API_USERNAME = process.env.API_USERNAME || require('./keys').apiUserName;
const API_PASSWORD = process.env.API_PASSWORD || require('./keys').apiPassword;
const API_URL = process.env.API_URL || require('./keys').apiUrl;
const LOCATION_API_KEY = process.env.LOCATION_API_KEY || require('./keys').locationApiKey;

const api = new SensorApi(API_USERNAME, API_PASSWORD, API_URL);
const restaurants = new RestaurantService(LOCATION_API_KEY);

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
        return api.temperature().then(response => {
            const retVal = {
                temperature: response.Temperature / 100,
                humidity: response.Humidity,
                noise: response.Noise,
                light: response.Light
            };
            // Slack format for code block ```triple backticks```
            return `\`\`\`${JSON.stringify(retVal)}\`\`\``;
        }).catch(error => {
            return 'Service is offline';
        });
    };

    const getLunchPlace = () => {
        return restaurants.getRestaurant().then(response => { 
            return `How about ${response}?`; 
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