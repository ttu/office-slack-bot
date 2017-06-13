'use strict';

const Botkit = require('botkit');
const Config = require('./configuration');
const moment = require('moment');
moment.locale('fi');

// If constants not found from environment variables, try to get it from keys.js file
const BOT_TOKEN = process.env.BOT_TOKEN || Config.botToken;
const HOME_CHANNEL_ID = process.env.CHANNEL_ID || Config.homeChannelId;

const myBot = require('./bot');

const controller = Botkit.slackbot({
    debug: false
});

const botInstance = controller.spawn({
    token: BOT_TOKEN
}).startRTM();

const userConfig = {
    user: Config.slackAdminUserId
};

controller.on(['direct_message', 'direct_mention'], (bot, message) => {
    bot.api.users.info({ user: message.user }, (error, response) => {
        if (Config.allowGuestsToUse || (!response.user.is_restricted && !response.user.is_ultra_restricted)) {
            const caller = { name: response.user.real_name, email: response.user.profile.email };
            myBot.handle(message.text, caller).then(response => {
                if (response)
                    bot.reply(message, response);
            });
        } else {
            bot.reply(message, 'No rights to chat with Bot');
        }
    });
});

const hearify = str => {
    return "\b(.*?)" + str + "(.*?)\b";
}
let lunchSuggestTimer = moment().subtract(5, 'minutes');
controller.hears([hearify('lounas'), hearify('ruoka'), hearify('syö(d|m)ään')], 'ambient', (bot, message) => {
    if(!Config.autoLunchSuggest) {
        return;
    }
    if(moment().hour() <= 10 || moment().hour() > 13) {
        return;
    }
    if(!response.text || !response.user) {
        return;
    }
    if(moment().diff(lunchSuggestTimer, 'minutes', true) < 5) {
        return;
    }
    lunchSuggestTimer = moment();
    bot.api.users.info({ user: message.user }, (error, response) => {
        if(Config.allowGuestsToUse || (!response.user.is_restricted && !response.user.is_ultra_restricted)) {
            const caller = { name: response.user.real_name, email: response.user.profile.email };
            myBot.handle('lunch', caller).then(response => {
                if(response) {
                    bot.reply(message, response);
                }
            });
        } else {
            bot.reply(message, "I won't listen to you!");
        }
    });
});

controller.on('rtm_close', () => {
    // Just exit. Forver or something similair will restart this
    process.exit();
});

myBot.setNotifyFunc((output) => {
    botInstance.startPrivateConversation(userConfig, (err, conversation) => {
        conversation.say(output);
    });
});

process.on('uncaughtException', (exception) => {
    console.log(exception);
    botInstance.startPrivateConversation(userConfig, (err, conversation) => {
        conversation.say(exception.stack);
        // Wait before exit so bot has time to send the last message
        setTimeout(() => process.exit(), 5000);
    });
});

process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
    botInstance.startPrivateConversation(userConfig, (err, conversation) => {
        conversation.say('Unhandled Rejection at Promise ' + reason.message);
    });
});
