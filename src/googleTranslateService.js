const Translate = require('@google-cloud/translate');

class TranslateService {
  constructor(keyPath) {
    this.translate = new Translate({
      keyFilename: keyPath
    });
  }

  detectLanguage(text) {
    return this.translate.detect(text).then(results => {
      const detections = results[0];
      return Array.isArray(detections) ? detections : [detections];
    });
  }

  translateText(text, language) {
    return this.translate.translate(text, language).then(results => {
      const translations = results[0];
      return Array.isArray(translations) ? translations : [translations];
    });
  }

  getPriceCents(text) {
    // Cost is $20 per 1,000,000 characters
    return `Translation service fee: ${(text.length * 0.002).toFixed(3)}¢`;
  }
}

module.exports = TranslateService;
