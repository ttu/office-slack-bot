const TranslateService = require('../src/googleTranslateService');

(async () => {
  try {
    const t = new TranslateService();

    const original = 'Office bot on nyt oppinut huomauttamaan kohteliaasti väärästä kielestä';
    const detections = await t.detectLanguage(original);

    console.log('Detections:');
    detections.forEach(detection => {
      console.log(JSON.stringify(detection));
      console.log(`${detection.input} => ${detection.language}`);
    });

    if (detections[0].language !== 'en') {
      const translation = await t.translateText(original);
      console.log(`Text: ${original}`);
      console.log(`Translation: ${translation}`);
    }
  } catch (err) {
    console.log(`Error: ${err}`);
  }
})();
