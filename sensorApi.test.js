'use strict';

const assert = require('assert');
const SensorApi = require('./sensorApi');

describe('SensorApi tests', () => {
    it('should get row count', done => {
        // Run server on localhost
        const sApi = new SensorApi('xxx', 'xxx', 'localhost:8080');
        sApi.hasPeople().then(result => {
            done();
        });
    });
});