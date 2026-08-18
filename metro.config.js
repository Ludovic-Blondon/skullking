const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Les migrations Drizzle sont importées comme des modules `.sql` (PLAN.md §5 :
// migrations versionnées et embarquées dès la v1).
config.resolver.sourceExts.push('sql');

module.exports = withNativeWind(config, { input: './src/global.css' });
