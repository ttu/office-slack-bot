const GooglePlacesService = require('../src/googlePlacesService');
const Config = require('../src/configuration');

describe('GooglePlacesService tests', () => {
  it('should get restaurants', done => {
    const restaurants = new GooglePlacesService(Config.locationApiKey, Config.office, 'restaurant');
    restaurants.getRandomPlace().then(response => {
      done();
    });
  });
});
