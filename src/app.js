'use strict';

const Botkit = require('botkit');
const Config = require('./configuration');

// If constants not found from environment variables, try to get it from configuration.js file
const BOT_TOKEN = process.env.BOT_TOKEN || Config.botToken;

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
            const caller = { name: response.user.real_name, email: response.user.profile.email, channel: message.channel };
            myBot.handle(message.text, caller).then(response => {
                if (!response) return;

                if (response.channel)
                    bot.say({ text: response.text, channel: response.channel });
                else if (response.confirm)
                    handleConfirmConversation(bot, message.user, response);
                else
                    bot.reply(message, response);
            });
        } else {
            bot.reply(message, 'No rights to chat with Bot');
        }
    });
});

controller.hears(['.'], ['ambient'], async (bot, msg) => {
    var response = await myBot.translate(msg.channel, msg.text);
    if (response) {
        bot.reply(msg, response);
    }
});

const handleConfirmConversation = (bot, user, confirmResponse) => {
    bot.startPrivateConversation({ user: user }, (err, convo) => {
        convo.ask(confirmResponse.text, [
            {
                pattern: 'yes',
                callback: (response, convo) => {
                    confirmResponse.action().then(result => {
                        convo.say(result);
                        convo.next();
                    });
                }
            },
            {
                pattern: 'no',
                callback: (response, convo) => {
                    convo.say('Ok, rejected');
                    convo.next();
                }
            },
            {
                default: true,
                callback: (response, convo) => {
                    convo.repeat();
                    convo.next();
                }
            }
        ]);
    });
};

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

setInterval(async () => { 
    const btcValue = await myBot.handle('bitcoin');
    // C3KLS2PDE, U03ADJY9U
    botInstance.say({ channel: 'C3KLS2PDE', text: btcValue });
}, 12 * 60 * 60 * 1000);