const fetch = require('node-fetch');
const moment = require('moment');

moment.locale('fi');

const SensorApi = require('./sensorApi');
const GooglePlacesService = require('./googlePlacesService');
const CalendarService = require('./calendarService');
const Config = require('./configuration');
const EmailSender = require('./emailSender');
const SlackChannelStats = require('./slackChannelStats');
const WebScraper = require('./webScraper');
const TranslateService = require('./googleTranslateService');

const api = new SensorApi(Config.apiUserName, Config.apiPassword, Config.apiUrl, Config.sensors);
const restaurantsService = new GooglePlacesService(Config.locationApiKey, Config.office, 'restaurant');
const barsService = new GooglePlacesService(Config.locationApiKey, Config.office, 'bar', 800);
const calendar = new CalendarService(Config.meetingRooms);
const email = new EmailSender(
  Config.emailConfig,
  Config.emailMessage.subject,
  Config.emailMessage.template,
  Config.emailMessage.receiver
);
const slackStats = new SlackChannelStats(Config.botToken);
const webScraper = new WebScraper(Config.webScraperOptions);
const translator = new TranslateService(Config.translator.keyPath);

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
  const bitcoin = ['bitcoin'];
  const stats = ['stats'];
  const web = ['web'];
  const translate = ['translate', 'translating', 'translation'];

  // Slack format for code block ```triple backticks```
  const outputFormat = text => `\`\`\`${text}\`\`\``;

  const hasPeople = () => {
    return api
      .hasPeople()
      .then(resonse => {
        const text = resonse ? 'Office has people' : 'Office is empty';
        return outputFormat(text);
      })
      .catch(error => {
        notifyFunc(`hasPeople failed: ${error}`);
        return 'Service is offline';
      });
  };

  const temperature = () => {
    const promises = Config.sensors.map(s => {
      return new Promise((resolve, reject) => {
        api
          .temperature(s)
          .then(([sensor, response]) => {
            const sensorData = {
              name: sensor.name,
              temperature: response.Temperature / 100,
              humidity: response.Humidity,
              noise: response.Noise,
              light: response.Light,
              time: moment(response.MeasurementTime).format('HH:mm DD.MM.')
            };
            resolve(sensorData);
          })
          .catch(errorMessag => {
            notifyFunc(`temperature failed: ${errorMessag}`);
            // Because Promise.all will fail fast, on error resolve null instead of reject
            resolve(null);
          });
      });
    });

    return Promise.all(promises).then(values => {
      const lines = values
        .filter(e => e !== null)
        .reduce((prev, curr) => {
          return `${prev}${prev !== '' ? '\n' : ''}${JSON.stringify(curr)}`;
        }, '');
      return outputFormat(lines);
    });
  };

  const getPlaces = service => {
    return service
      .getPlaces()
      .then(response => `How about ${response}?`)
      .catch(error => {
        notifyFunc(`getPlaces failed: ${error.stack || error}`);
        return 'Error while fetching places';
      });
  };

  const getCurrentEvents = async () => {
    try {
      const eventsText = await calendar.getEventsText(2);
      return outputFormat(eventsText);
    } catch (error) {
      notifyFunc(`getCurrentEvents failed: ${error.stack || error}`);
      return 'Error with current reservations';
    }
  };

  const getFreeSlotDuration = async () => {
    try {
      const eventsText = await calendar.getFreeText();
      return outputFormat(eventsText === '' ? 'No free meeting rooms' : `Free for:\n${eventsText}`);
    } catch (error) {
      notifyFunc(`getFreeSlotDuration failed: ${error.stack || error}`);
      return 'Error with free meeting rooms';
    }
  };

  const bookMeetingRoom = (params, booker) => {
    const room = params[1];
    let duration = 15;

    if (params[2]) {
      const lastThree = params[2].substr(params[2].length - 3);
      const d = lastThree === 'min' ? parseInt(params[2].slice(0, -3)) : parseInt(params[2]);

      if (!Number.isInteger(d)) return Promise.resolve(`Invalid duration`);
      if (d > 600) return Promise.resolve(`Booking time can't be more than 600 minutes`);
      if (d < 1) return Promise.resolve(`Booking time can't be less than 1 minute`);
      duration = d;
    }

    return calendar
      .bookEvent(booker, room, duration)
      .then(result => result)
      .catch(error => {
        notifyFunc(`bookMeetingRoom failed: ${params} ${error.message || error}`);
        return `Error with booking a meeting room - ${error.message || error}`;
      });
  };

  const cancelMeetingRoom = (params, canceller) => {
    const room = params[1];

    return calendar
      .cancelEvent(canceller, room)
      .then(result => result)
      .catch(error => {
        notifyFunc(`cancelMeetingRoom: ${params} ${error.message || error}`);
        return `Error with cancelling a meeting - ${error.message || error}`;
      });
  };

  const postAnonymous = message => {
    const toSend = message.substr(message.indexOf(' ') + 1);
    return Promise.resolve({ text: `Anonymous: ${toSend}`, channel: Config.homeChannelId });
  };

  const sendMaintenanceEmail = (message, caller) => {
    if (message.indexOf(' ') === -1) return Promise.resolve(`Message is empty`);

    const toSend = message.substr(message.indexOf(' ') + 1);
    return Promise.resolve({
      text: `Email to maintenance:\n${outputFormat(email.getContent(toSend, caller.name))}\nSend now? (yes/no)`,
      confirm: true,
      action: () => email.send(toSend, caller.email, caller.name)
    });
  };

  const bitcoinValue = async () => {
    const result = await fetch(`https://api.coindesk.com/v1/bpi/currentprice.json`);
    const json = await result.json();
    return `Bitcoin: $${json.bpi.USD.rate}`;
  };

  const getScraperText = async params => webScraper.getText(params[1]);

  const channelStats = async (params, caller) => {
    const days = params[1] || 7;
    const top = params[2] || 5;

    const activity = await slackStats.getActivity(caller.channel, days, top);

    if (!activity) return Promise.resolve('Could not get channel history data');

    const topList = activity.top.reduce(
      (text, item) => `${text}  ${item.name} - ${item.count} (${item.percentage}%)\n`,
      ''
    );
    const listText = top === 0 ? 'Inactive users:' : 'Top users:';
    const text = `From: ${activity.from}\nActive users: ${activity.active}\nMessages: ${
      activity.messages
    }\n${listText}\n${topList}`;
    return outputFormat(text);
  };

  const translateText = async (channel, text) => {
    const channelConfig = Config.translator.channels[channel];
    if (!channelConfig || !channelConfig.enabled) return '';

    // This is emoji. TODO: Regex
    if (text.startsWith(':') && text.endsWith(':')) return '';
    // Message contains only a link. TODO: Regex
    if (text.indexOf(' ') === -1 && text.indexOf('http') > -1) return '';

    try {
      // Use max 25 characters to detect language. It should be enough.
      const detections = await translator.detectLanguage(text.substring(0, 25));
      if (detections[0].language !== Config.translator.language) {
        const toTranslate =
          Config.translator.maxCharacters && text.length > Config.translator.maxCharacters
            ? `${text.substring(0, Config.translator.maxCharacters)}...`
            : text;
        const translation = await translator.translateText(toTranslate, Config.translator.language);
        // Fix emojis
        const fixedText = translation[0].replace(/\s(?!(?:[^:]*:[^:]*:)*[^:]*$)/gm, '');

        if (fixedText !== toTranslate)
          return `${Config.translator.prefix}${fixedText} (${translator.getPriceCents(text)})`;
      }
    } catch (error) {
      notifyFunc(`Translate failed ${error.message || error}`);
    }
    return '';
  };

  // default empty notify function
  let notifyFunc = output => {};

  return {
    translate: (channel, text) => translateText(channel, text),
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
      }
      if (temp.some(e => e === command)) {
        return temperature();
      }
      if (lunch.some(e => e === command)) {
        return getPlaces(restaurantsService);
      }
      if (bar.some(e => e === command)) {
        return getPlaces(barsService);
      }
      if (free.some(e => e === command)) {
        return getFreeSlotDuration();
      }
      if (reservations.some(e => e === command)) {
        return getCurrentEvents();
      }
      if (book.some(e => e === command)) {
        return bookMeetingRoom(args, caller);
      }
      if (cancel.some(e => e === command)) {
        return cancelMeetingRoom(args, caller);
      }
      if (say.some(e => e === command)) {
        return postAnonymous(message);
      }
      if (maintenance.some(e => e === command)) {
        return sendMaintenanceEmail(message, caller);
      }
      if (bitcoin.some(e => e === command)) {
        return bitcoinValue();
      }
      if (stats.some(e => e === command)) {
        return channelStats(args, caller);
      }
      if (web.some(e => e === command)) {
        return getScraperText(args);
      }
      if (translate.some(e => e === command)) {
        const channelConfigs = Config.translator.channels;
        const channelConfig = channelConfigs[caller.channel];

        if (!channelConfig) channelConfigs[caller.channel] = { enabled: false };

        channelConfig.enabled = !channelConfig.enabled;
        return Promise.resolve(channelConfig.enabled ? 'translating' : 'translate off');
      }
      if (command === 'help') {
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
  bitcoin    Show current bitcoin price
  stats      Show current channel activity stats
  huolto     Send email to the maintenance company
  web        Get content from preconfigured sites (\`web list\` for available sites)
  translate  Toggle automatic translation on/off
  help       View this message (see \`help verbose\` for more)`;

        const verbose = `
Booking a room:
  book <room> [duration (minutes)]
  Duration defaults to 15 minutes and has to be more than 1 and less that 600 minutes.
  Duration can have a 'min'-suffix to better disambiguate its meaning for users.

Cancelling a reservation:
  cancel <room>
  This command will cancel the first meeting that meets the following criteria:
    - The reservation was placed by SlackBot
    - The canceller is the same person that booked the room
    
Send email to the maintenace company:
  huolto <message>
  This command sends email to the mainetenance company. Slack user is added as a sender and
  copy of the email is also sent to the sender. Bot will confirm the message before sending.
  
Get channel activity statistic:
  stats <days> <top>
  Days default to the last 7 days and the top list length default is 5.
  If top is 0, will only return inactive users.

Automatic translation:
  translate
  Toggle automatic translation on/off. Automatically tanslates all text that is not in english to english.

Get content from preconfigured sites:
  web <id>
  Type \`web list\` for available sites.
  Ids: ${Object.keys(Config.webScraperOptions)}`;

        const output = args[1] && args[1] === 'verbose' ? `${help}\n\n${verbose}` : help;
        return Promise.resolve(outputFormat(output));
      }

      return Promise.resolve(`I didn't understand. See _help_ for usage instructions.`);
    }
  };
};

module.exports = bot();
