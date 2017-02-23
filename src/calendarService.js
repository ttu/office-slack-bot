var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
const google = require('googleapis');
const googleAuth = require('google-auth-library');

class CalendarService {
    constructor(calendars) {
        this.calendars = calendars;
    }

    process(eventCount = 1) {
        return new Promise(async (resolve, reject) => {
            try {
                const client = await this.getOAuthClient();
                const events = await this.getCurrentOrNextEvent(eventCount, client);
                resolve(events);
            } catch (err) {
                reject(err);
            }
        });
    }

    async getOAuthClient() {
        const secretPromise = fs.readFileAsync('client_secret2.json');
        const tokenPromise = fs.readFileAsync('calendar-authToken.json');
        const secret = await secretPromise;
        const token = await tokenPromise;

        const credentials = JSON.parse(secret);
        const clientSecret = credentials.installed.client_secret;
        const clientId = credentials.installed.client_id;
        const redirectUrl = credentials.installed.redirect_uris[0];

        const auth = new googleAuth();
        const oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);
        oauth2Client.credentials = JSON.parse(token);
        return oauth2Client;
    }

    async getCurrentOrNextEvent(eventCount, auth) {
        const promises = this.calendars.map(c => {
            const params = {
                auth: auth,
                calendarId: c.id,
                timeMin: (new Date()).toISOString(),
                maxResults: eventCount,
                singleEvents: true,
                orderBy: 'startTime'
            };
            return new Promise((resolve, reject) => {
                google.calendar('v3').events.list(params, (err, response) => {
                    if (err) {
                        resolve([false, 'The API returned an error: ' + err]);
                        return;
                    }

                    const events = response.items.map(e => {
                        return {
                            name: c.name,
                            start: e.start.dateTime || e.start.date,
                            end: e.end.dateTime || e.end.date,
                            summary: e.summary
                        }
                    });

                    resolve([true, events]);
                });
            });
        }, this);

        return await Promise.all(promises).then(results => {
            return results.reduce((p, [success, result]) => {
                return success ? p.concat(result) : p;
            }, []);
        });
    }
}

module.exports = CalendarService;