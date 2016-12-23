'use strict';

const request = require('superagent');

class SensorApi {
    constructor(username, password, url, sensors) {
        this.username = username;
        this.password = password;
        this.url = url;
        this.sensors = sensors;
    }

    hasPeople() {
        const promises = this.sensors.map(sensor => {
            return new Promise((resolve, reject) => {
                request
                    .get(`${this.url}/api/haspeople/${sensor.id}`)
                    .auth(this.username, this.password)
                    .end((err, res) => {
                        err || !res.ok ? reject(err) : resolve(res.body > 0);
                    });
            });
        }, this);

        return Promise.all(promises).then(values => {
            return values.some(e => e === true);
        });
    }

    temperature(sensor) {
        return new Promise((resolve, reject) => {
            request
                .get(`${this.url}/api/data/${sensor.id}`)
                .auth(this.username, this.password)
                .end((err, res) => {
                    err || !res.ok ? reject(err) : resolve([sensor, res.body[0]]);
                });
        });
    }
}

module.exports = SensorApi;