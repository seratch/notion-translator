const deepl = require("deepl-node");
// Note that developer account is required for this
const translator = new deepl.Translator(process.env.DEEPL_API_TOKEN);

exports.translateText = async(richTextArray, from, to) => {
  for (const each of richTextArray) {
    if (each.plain_text) {
      if(!from){
        from = await detectSourceLanguage(each.plain_text);
        to = (from === "EN") ?  "JA" : "en-US";
      }
      const result = await translator.translateText(each.plain_text, from, to);
      each.plain_text = result.text;
      if (each.text) {
        each.text.content = each.plain_text;
      }
    }
  }
  return {from, to};
}

async function detectSourceLanguage(plainText){
  const result = await translator.translateText(plainText, null, "en-US");
  return result.detected_source_language === "EN" ?  "EN" : "JA";
}
