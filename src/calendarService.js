const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const google = require('googleapis');
const googleAuth = require('google-auth-library');
const moment = require('moment');
moment.locale('fi');

class CalendarService {
    constructor(calendars) {
        this.calendars = calendars;
    }

    getEvents(eventCount = 1) {
        return new Promise(async(resolve, reject) => {
            try {
                const client = await this.getOAuthClient();
                const events = await this.getCurrentOrNextEvents(eventCount, client);
                resolve(events);
            } catch (err) {
                reject(err);
            }
        });
    }

    bookEvent(booker, meetingRoom, durationMinutes = 15) {
        return new Promise(async(resolve, reject) => {
            try {
                const client = await this.getOAuthClient();
                const bookingResult = await this.bookMeetingRoom(booker, meetingRoom, new Date(), durationMinutes, client);
                resolve(bookingResult);
            } catch (err) {
                reject(err);
            }
        });
    }

    cancelEvent(canceller, meetingRoom) {
        return new Promise(async(resolve, reject) => {
            try {
                const client = await this.getOAuthClient();
                const cancelResult = await this.cancelMeeting(canceller, meetingRoom, client);
                resolve(cancelResult);
            } catch (err) {
                reject(err);
            }
        });
    }

    async getOAuthClient() {
        const secretPromise = fs.readFileAsync('client_secret.json');
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

    async getCurrentOrNextEvents(eventCount, auth) {
        const promises = this.calendars.map(c => {
            return this.getCalendarEvents(c.name, c.id, eventCount, auth);
        }, this);

        return await Promise.all(promises).then(results => {
            return results.reduce((p, [success, result]) => {
                return success ? p.concat(result) : p;
            }, []);
        });
    }

    async getCalendarEvents(calendarName, calendarId, eventCount, auth) {
        const params = {
            auth: auth,
            calendarId: calendarId,
            timeMin: (new Date()).toISOString(),
            maxResults: eventCount,
            singleEvents: true,
            orderBy: 'startTime'
        };
        return new Promise((resolve, reject) => {
            google.calendar('v3').events.list(params, (err, response) => {
                if (err) {
                    resolve([false, 'The API (calendar.events.list) returned an error: ' + err]);
                    return;
                }

                const events = response.items.map(e => {
                    return {
                        // Event id
                        id: e.id,
                        name: calendarName,
                        // Event start time (DateTime)
                        start: e.start.dateTime || e.start.date,
                        // Event end time (DateTime)
                        end: e.end.dateTime || e.end.date,
                        summary: e.summary,
                        description: e.description,
                        attendees: e.attendees,
                        creator: e.creator
                    }
                });

                resolve([true, events]);
            });
        });
    }

    async bookMeetingRoom(booker, roomName, start, durationMinutes, auth) {
        if (!roomName)
            return Promise.resolve(`Define room name. (${this.calendars.map(c => c.name)})`)

        var selected = this.calendars.filter(c => c.name.toUpperCase() == roomName.toUpperCase());

        if (selected.length == 0)
            return Promise.resolve(`${roomName} not found. (${this.calendars.map(c => c.name)})`)

        const [success, nextReservation] = await this.getCalendarEvents(selected[0].name, selected[0].id, 1, auth);
        if (!success)
            return Promise.resolve(`Failed to get calendar events`);

        const end = new Date(start.getTime() + durationMinutes * 60000);
        if((end >= nextReservation[0].start || end < nextReservation[0].end) && (start <= nextReservation[0].end || start > nextReservation[0].start))
            return Promise.resolve(`Can't book ${roomName} for ${durationMinutes} minutes at ${moment(start).format()}. Room is already reserved from ${moment(overlappingReservations[0].start).format('H:mm')} till ${moment(overlappingReservations[0].end).format('H:mm')}.`);

        const event = {
            'summary': `${ booker.name || booker.email } - SlackBot quick booking`,
            'description': `Quick booking made from SlackBot for ${booker.name} - ${booker.email}`,
            'start': {
                'dateTime': start
            },
            'end': {
                'dateTime': end
            },
            'attendees': [{
                'email': booker.email
            }]
        };

        return new Promise((resolve, reject) => {
            google.calendar('v3').events.insert({
                'auth': auth,
                'calendarId': selected[0].id,
                'resource': event
            }, (err, response) => {
                if (err) {
                    reject(`The API (calendar.events.insert) returned an error: ${err}\ncalendarId: ${selected[0].id}\nresource: ${JSON.stringify(event, null, 4)}`);
                }
                resolve(`${selected[0].name} booked for ${durationMinutes} minutes at ${moment(start).format('H:mm')}`);
            });
        });
    }

    async cancelMeeting(canceller, roomName, auth) {
        if(!roomName)
            return Promise.resolve(`Define room name. (${this.calendars.map(c => c.name)})`)
        var selected = this.calendars.filter(c => c.name.toUpperCase() == roomName.toUpperCase());
        if(selected.length == 0)
            return Promise.resolve(`${roomName} not found. (${this.calendars.map(c => c.name)})`);

        const [success, upcomingReservations] = await this.getCalendarEvents(selected[0].name, selected[0].id, 100, auth);
        if (!success)
            return Promise.resolve(`Failed to get calendar events`);

        const cancellerReservations = upcomingReservations.filter(reservation =>
                reservation.creator.email == canceller.email &&
                reservation.description.includes("Quick booking made from SlackBot for"));
        if (cancellerReservations.length == 0)
            return Promise.resolve(`${canceller.email} has not made any room reservations - Cannot cancel`);

        return new Promise((resolve, reject) => {
            google.calendar('v3').events.delete({
                'calendarId': selected[0].id,
                'eventId': cancellerReservations[0].id,
                'auth': auth
            }, (err, response) => {
                if (err)
                    reject('The API (calendar.events.delete) returned an error: ' + err);
                resolve(`Reservation of ${selected[0].name} at ${cancellerReservations[0].start.dateTime} by ${canceller.email} has been cancelled`);
            });
        });
    }
}

module.exports = CalendarService;
