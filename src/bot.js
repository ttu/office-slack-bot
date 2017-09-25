'use strict';

const moment = require('moment');
moment.locale('fi');

const SensorApi = require('./sensorApi');
const GooglePlacesService = require('./googlePlacesService');
const CalendarService = require('./calendarService');
const Config = require('./configuration');
const EmailSender = require('./emailSender');

const API_USERNAME = process.env.API_USERNAME || Config.apiUserName;
const API_PASSWORD = process.env.API_PASSWORD || Config.apiPassword;
const API_URL = process.env.API_URL || Config.apiUrl;
const LOCATION_API_KEY = process.env.LOCATION_API_KEY || Config.locationApiKey;
const HOME_CHANNEL = Config.homeChannelId;

const api = new SensorApi(API_USERNAME, API_PASSWORD, API_URL, Config.sensors);
const restaurants = new GooglePlacesService(LOCATION_API_KEY, Config.office, 'restaurant');
const bars = new GooglePlacesService(LOCATION_API_KEY, Config.office, 'bar', 800);
const calendar = new CalendarService(Config.meetingRooms);
const email = new EmailSender(
                        Config.emailConfig, 
                        Config.emailMessage.subject, 
                        Config.emailMessage.template, 
                        Config.emailMessage.receiver);

// Bot returns object literal instead of class, so we can have private functions
const bot = () => {
    const anyone = ['people', 'anyone', 'any'];
    const temp = ['temp', 'temperature'];
    const lunch = ['lunch', 'lounas'];
    const bar = ['bar', 'beer', 'kaljaa'];
    const free = ['free', 'vapaa'];
    const reservations = ['rooms', 'reservations', 'current', 'neukkarit'];
    const book = ['book'];
    const cancel = ['cancel'];
    const say = ['say'];
    const maintenance = ['maintenance', 'huolto'];
    
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
                    // Because Promise.all will fail fast, on error resolve null instead of reject
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

    const getPlaces = (service) => {
        return service.getPlaces().then(response => {
            return `How about ${response}?`;
        }).catch(error => {
            notifyFunc('getPlaces failed: ' + (error.stack || error));
            return 'Error while fetching places';
        });
    };

    const getCurrentEvents = () => {
        return calendar.getEvents(2).then(events => {
            const eventsText = events.reduce((acc, cur) => {
                const start = moment(cur.start).format('DD.MM. HH:mm');
                const end = moment(cur.end).format('HH:mm');
                return `${acc}${acc !== '' ? '\n' : ''}${cur.name} - ${start} to ${end} - ${cur.summary}`
            }, 'Next 2 reservations:');
            return outputFormat(eventsText);
        }).catch(error => {
            notifyFunc('getCurrentEvents failed: ' + (error.stack || error));
            return 'Error with current reservations';
        });
    };

    const getFreeSlotDuration = () => {
        return calendar.getEvents().then(events => {
            const eventsText = Config.meetingRooms.reduce((acc, cur) => {
                const e = events.find(e => e.name == cur.name);

                if (!e)
                    return `${acc}${acc !== '' ? '\n' : ''}${cur.name} - indefinitely`;

                const diff = moment.duration(moment(e.start).diff(moment()));
                const diffAsHours = diff.asHours();
                if (diffAsHours > 0 && diffAsHours < 1) {
                    return `${acc}${acc !== '' ? '\n' : ''}${e.name} - ${diff.asMinutes().toFixed(0)} minutes`
                } else if (diffAsHours > 0) {
                    return `${acc}${acc !== '' ? '\n' : ''}${e.name} - ${diffAsHours.toFixed(1)} hours`
                } else {
                    return acc;
                }
            }, '');
            return outputFormat(eventsText === '' ? 'No free meeting rooms' : 'Free for:\n' + eventsText);
        }).catch(error => {
            notifyFunc('getFreeSlotDuration failed: ' + (error.stack || error));
            return 'Error with free meeting rooms';
        });
    };

    const bookMeetingRoom = (params, booker) => {
        const room = params[1];
        let duration = 15;

        if (params[2]) {
            const lastThree = params[2].substr(params[2].length - 3);
            const d = lastThree == 'min' ? parseInt(params[2].slice(0, -3)) : parseInt(params[2]);

            if (!Number.isInteger(d))
                return Promise.resolve(`Invalid duration`);
            if (d > 60)
                return Promise.resolve(`Booking time can't be more than 60 minutes`);
            if (d < 1)
                return Promise.resolve(`Booking time can't be less than 1 minute`);
            duration = d;
        }

        return calendar.bookEvent(booker, room, duration).then(result => {
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

    const postAnonymous = (message) => {
        const toSend = message.substr(message.indexOf(' ') + 1);
        return Promise.resolve({ text: `Anonymous: ${toSend}`, channel: HOME_CHANNEL });
    }

    const sendMaintenanceEmail = (message, caller) => {
        if (message.indexOf(' ') == -1)
            return Promise.resolve(`Message is empty`);

        const toSend = message.substr(message.indexOf(' ') + 1);
        return Promise.resolve({ 
            text: `Email to maintenance:\n${outputFormat(email.getContent(toSend, caller.name))}\nSend now? (yes/no)`, 
            confirm: true, 
            action: () => email.send(toSend, caller.email, caller.name) 
        });
    }

    // default empty notify function
    let notifyFunc = (output) => {};

    return {
        setNotifyFunc(func) {
            notifyFunc = func;
        },
        /**
         * @param   {string} message 
         * @param   {{name: string, email: string}} caller
         * @returns {Promise<string> | Promise<{text:string, channel:string }> | Promise<{text:string, confirm:bool, action: () => Promise<string> }>}
         *          Promise containing a message
         *          Promise containing a message and a reply channel id
         *          Promise containing confirmation message and action to be executed. Action returns Promise containing a message
         */
        handle(message, caller) {
            const args = message.toLowerCase().split(' ');
            const command = args[0];

            if (anyone.some(e => e === command)) {
                return hasPeople();
            } else if (temp.some(e => e === command)) {
                return temperature();
            } else if (lunch.some(e => e === command)) {
                return getPlaces(restaurants);
            } else if (bar.some(e => e === command)) {
                return getPlaces(bars);
            } else if (free.some(e => e === command)) {
                return getFreeSlotDuration();
            } else if (reservations.some(e => e === command)) {
                return getCurrentEvents();
            } else if (book.some(e => e === command)) {
                return bookMeetingRoom(args, caller);
            } else if (cancel.some(e => e === command)) {
                return cancelMeetingRoom(args, caller);
            } else if (say.some(e => e === command)) {
                return postAnonymous(message);
            } else if (maintenance.some(e => e === command)) {
                return sendMaintenanceEmail(message, caller);
            } else if (command === 'help') {

                const help = `
Options:
  say        Say something anonymously
  anyone     Is there anyone in the office
  temp       Get the office temperature
  free       List free meeting rooms
  rooms      List upcoming meeting room reservations
  book       Book a meeting room
  cancel     Cancel a meeting
  lunch      Suggest a lunch place
  beer       Suggest a beer place
  huolto     Send email to the maintenance company
  help       View this message (see \`help verbose\` for more)`;

                const verbose = `
Booking a room:
  book <room> [duration]
  Duration defaults to 15 minutes and has to be more than 1 and less that 60 minutes.
  Duration can have a 'min'-suffix to better disambiguate its meaning for users.

Cancelling a reservation:
  cancel <room>
  This command will cancel the first meeting that meets the following criteria:
    - The reservation was placed by SlackBot
    - The canceller is the same person that booked the room
    
Send email to the maintenace company:
  huolto <message>
  This command sends email to the mainetenance company. Slack user is added as a sender and
  copy of the email is also sent to the sender. Bot will confirm the message before sending.`;

                const output = args[1] && args[1] == 'verbose' ? help + '\n\n' + verbose : help;
                return Promise.resolve(outputFormat(output));
            }

            return Promise.resolve(`I didn't understand. See _help_ for usage instructions.`);
        }
    }
}

module.exports = bot();