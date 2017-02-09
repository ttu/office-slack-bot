const fs = require('fs');
const google = require('googleapis');
const googleAuth = require('google-auth-library');

class CalendarService {
    constructor(calendars) {
        this.calendars = calendars;
    }

    process(eventCount = 1) {
        return new Promise((resolve, reject) => {
            this.getOAuthClient((error, result) => {
                if (error)
                    reject(error);
                else {
                    this.getCurrentOrNextEvent(eventCount, result, (error, events) => {
                        if (error)
                            reject(error);
                        else
                            resolve(events);
                    });
                }
            });
        });
    }

    getOAuthClient(cb) {
        fs.readFile('client_secret.json', (err, content) => {
            if (err) {
                cb('Error loading client secret file - ' + err);
                return;
            }

            // Check if we have previously stored a token.
            fs.readFile('calendar-authToken.json', (err, token) => {
                if (err) {
                    cb('Create new auth token - ' + err);
                } else {
                    const credentials = JSON.parse(content);
                    var clientSecret = credentials.installed.client_secret;
                    var clientId = credentials.installed.client_id;
                    var redirectUrl = credentials.installed.redirect_uris[0];
                    var auth = new googleAuth();
                    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);
                    oauth2Client.credentials = JSON.parse(token);
                    cb(null, oauth2Client);
                }
            });
        });
    }

    getCurrentOrNextEvent(eventCount, auth, cb) {
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

        Promise.all(promises).then(results => {
            const allInOne = results.reduce((p, [success, result]) => {
                return success ? p.concat(result) : p;
            }, []);

            cb(null, allInOne);
        });
    }
}

module.exports = CalendarService;