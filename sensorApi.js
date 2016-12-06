'use strict';

const request = require('superagent');

class SensorApi {
    constructor(username, password, url) {
        this.username = username;
        this.password = password;
        this.url = url;
    }

    hasPeople() {
        const sensors = ['000D6F0004476483', '000D6F0003141E14'];

        const promises = sensors.map(sensorId => {
            return new Promise((resolve, reject) => {
                request
                    .get(`${this.url}/api/haspeople/${sensorId}`)
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

    temperature() {
        return new Promise((resolve, reject) => {
            request
                .get(`${this.url}/api/data/000D6F0004476483`)
                .auth(this.username, this.password)
                .end((err, res) => {
                    err || !res.ok ? reject(err) : resolve(res.body[0]);
                });
        });
    }
}

module.exports = SensorApi;