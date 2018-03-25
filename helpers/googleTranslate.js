const TranslateService = require("../src/googleTranslateService");

(async () => {
  try {
    const t = new TranslateService();

    // const original = 'Office bot on nyt oppinut huomauttamaan kohteliaasti väärästä kielestä';
    const original = "Book 5 null";
    const detections = await t.detectLanguage(original);

    console.log("Detections:");
    detections.forEach(detection => {
      console.log(JSON.stringify(detection));
      console.log(`${detection.input} => ${detection.language}`);
    });

    if (detections[0].language !== "en") {
      const translation = await t.translateText(original);
      console.log(`Text: ${original}`);
      console.log(`Translation: ${translation}`);
    }

    // const original = 'Office bot on nyt oppinut huomauttamaan kohteliaasti';
    // const translation = await t.translateText(original);
    // console.log(`Text: ${original}`);
    // console.log(`Translation: ${translation}`);
  } catch (err) {
    console.log(`Error: ${err}`);
  }
})();
