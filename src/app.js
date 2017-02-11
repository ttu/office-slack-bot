'use strict';

const Botkit = require('botkit');

// If constants not found from environment variables, try to get it from keys.js file
const BOT_TOKEN = process.env.BOT_TOKEN || require('./keys').botToken;
const HOME_CHANNEL_ID = process.env.CHANNEL_ID || require('./keys').homeChannelId;

const myBot = require('./bot');

const controller = Botkit.slackbot({ debug: false });
controller.spawn({ token: BOT_TOKEN }).startRTM();

controller.on(['direct_message', 'direct_mention'], (bot, message) => {
    myBot.handle(message.text).then(response => {
        bot.reply(message, response);
    });
});
