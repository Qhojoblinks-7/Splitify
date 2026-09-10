const { getDefaultConfig } = require("expo/metro-config");

module.exports = (() => {
  const config = getDefaultConfig(__dirname);
  const { transformer, resolver } = config;

  config.transformer = {
    ...transformer,
    // Connects the automated svg translator script
    babelTransformerPath: require.resolve("react-native-svg-transformer/expo"),
  };

  config.resolver = {
    ...resolver,
    // Tells Metro to stop treating SVGs as standard visual image assets...
    assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
    // ...and start treating them as source-code components!
    sourceExts: [...resolver.sourceExts, "svg"],
  };

  return config;
})();