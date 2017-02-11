'use strict';

const assert = require('assert');
const RestaurantService = require('../src/restaurantService');
const Config = require('../src/configuration');

describe('RestaurantService tests', () => {
    it('should get restaurants', done => {
        const restaurants = new RestaurantService(Config.locationApiKey, Config.office);
        restaurants.getRestaurant().then(response => {
            done();
        });
    });
});