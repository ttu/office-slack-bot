const Translate = require('@google-cloud/translate');

class TranslateService {
  constructor(keyPath) {
    this.translate = new Translate({
      keyFilename: keyPath
    });
  }

  async detectLanguage(text) {
    const results = await this.translate.detect(text);
    const detections = results[0];
    return Array.isArray(detections) ? detections : [detections];
  }

  async translateText(text, language) {
    const results = await this.translate.translate(text, language);
    const translations = results[0];
    return Array.isArray(translations) ? translations : [translations];
  }

  getPriceCents(text) {
    // Cost is $20 per 1,000,000 characters      
    return `Translation service fee: ${(text.length * 0.002).toFixed(3)}¢`;
  }
}

module.exports = TranslateService;
