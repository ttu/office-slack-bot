'use strict';

const Botkit = require('botkit');
const SensorApi = require('./sensorApi');

// If constants not found from environment variables, try to get it from keys.js file
const BOT_TOKEN = process.env.BOT_TOKEN || require('./keys').botToken;
const HOME_CHANNEL_ID = process.env.CHANNEL_ID || require('./keys').homeChannelId;
const API_USERNAME = process.env.API_USERNAME || require('./keys').apiUserName;
const API_PASSWORD = process.env.API_PASSWORD || require('./keys').apiPassword;
const API_URL = process.env.API_URL || require('./keys').apiUrl;

const api = new SensorApi(API_USERNAME, API_PASSWORD, API_URL);

const controller = Botkit.slackbot({ debug: false });
controller.spawn({ token: BOT_TOKEN }).startRTM();

controller.hears(['Anyone', 'anyone'], ['direct_message', 'direct_mention'], (bot, message) => {
    api.hasPeople().then(hasPeople => {
        bot.reply(message, hasPeople ? 'Office has people' : 'Office is empty');
    }).catch(error => {
        bot.reply(message, 'Service is offline');
    });
});

controller.hears(['Hello', 'hello', 'Hi', 'hi'], ['direct_message', 'direct_mention'], (bot, message) => {
    bot.reply(message, 'Hello!');
});
