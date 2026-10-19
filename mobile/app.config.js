module.exports = ({ config }) => {
  const production = process.env.EAS_BUILD_PROFILE === 'production';
  if (production && !/^https:\/\//.test(process.env.EXPO_PUBLIC_API_URL || '')) {
    throw new Error(
      'Set EXPO_PUBLIC_API_URL to your deployed HTTPS API before a production build.',
    );
  }
  return {
    ...config,
    plugins: config.plugins.map((plugin) =>
      Array.isArray(plugin) && plugin[0] === 'expo-build-properties'
        ? ['expo-build-properties', { android: { usesCleartextTraffic: !production } }]
        : plugin,
    ),
  };
};
