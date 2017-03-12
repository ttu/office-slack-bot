'use strict';

const Botkit = require('botkit');
const Config = require('./configuration');

// If constants not found from environment variables, try to get it from keys.js file
const BOT_TOKEN = process.env.BOT_TOKEN || Config.botToken;
const HOME_CHANNEL_ID = process.env.CHANNEL_ID || Config.homeChannelId;

const myBot = require('./bot');

const controller = Botkit.slackbot({ debug: false });
const botInstance = controller.spawn({ token: BOT_TOKEN }).startRTM();

controller.on(['direct_message', 'direct_mention'], (bot, message) => {
    myBot.handle(message.text).then(response => {
        if (response)
            bot.reply(message, response);
    });
});

controller.on('rtm_close', () => {
    // Just exit. Forver or something similair will restart this
    process.exit();
});

myBot.setNotifyFunc((output) => {
    botInstance.startPrivateConversation({ user: Config.slackAdminUserId }, function (err, conversation) {
        conversation.say(output);
    });
});

process.on('uncaughtException', (exception) => {
    console.log(exception);
    botInstance.startPrivateConversation({ user: Config.slackAdminUserId }, function (err, conversation) {
        conversation.say(exception.stack);
        // Wait before exit so bot has time to send the last message
        setTimeout(() => process.exit(), 5000);
    });
});

process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
    botInstance.startPrivateConversation({ user: Config.slackAdminUserId }, function (err, conversation) {
        conversation.say('Unhandled Rejection at Promise ' + reason.message);
    });
});