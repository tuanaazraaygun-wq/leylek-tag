// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];

// WEB İÇİN react-native-maps ve react-native-agora EXCLUDE ET
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Web'de react-native-maps ve react-native-agora'yı boş module olarak döndür
  if (platform === 'web' && (moduleName.includes('react-native-maps') || moduleName.includes('react-native-agora'))) {
    return {
      type: 'empty',
    };
  }
  // Diğer platformlar için default resolver
  return context.resolveRequest(context, moduleName, platform);
};

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

module.exports = config;
