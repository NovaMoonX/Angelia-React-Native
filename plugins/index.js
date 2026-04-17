const { withPlugins } = require('@expo/config-plugins');
const withFirebaseMessagingColor = require('./withFirebaseMessagingColor');

module.exports = (config) =>
  withPlugins(config, [
    withFirebaseMessagingColor,
    // add future plugins here, one line each
  ]);
