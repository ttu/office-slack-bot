'use strict';

const assert = require('assert');
const SensorApi = require('../src/sensorApi');
const Config = require('../src/configuration');

describe('SensorApi tests', () => {
    it('should get row count', done => {
        const sApi = new SensorApi(Config.apiUserName, Config.apiPassword, Config.apiUrl, Config.sensors);
        sApi.temperature(Config.sensors[0].id).then(result => {
            done();
        });
    });
});