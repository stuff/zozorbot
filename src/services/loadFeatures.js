const fs = require('fs');
const { eachSeries } = require('async');

async function loadFeatures(path, { config, controller, bot}) {
  const files = fs.readdirSync(path);
  const instances = [];

  await eachSeries(files, async (featureFilename) => {
    const shouldIgnore = featureFilename[0] === '_';
    const featurePath = `${path}/${featureFilename}`;

    if (shouldIgnore) {
      return;
    }

    const stats = fs.lstatSync(featurePath);

    if (stats.isDirectory()) {
      const Feature = require(featurePath);
      const instance = new Feature(controller, bot, config, featureFilename);
      await instance.start();
      instances.push(instance);
    }
  });

  return instances;
}

module.exports = loadFeatures;
