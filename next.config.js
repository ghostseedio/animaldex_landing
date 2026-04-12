const withNextIntl = require('next-intl/plugin')();

module.exports = withNextIntl({
    webpack: (config) => {
        config.module.rules.push({
            test: /\.md$/,
            use: 'raw-loader',
        });
        return config;
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'avatars.githubusercontent.com',
            },
            {
                protocol: 'https',
                hostname: 'wwhsdzpczekgdlobwaej.supabase.co',
                pathname: '/storage/v1/object/public/**',
            },
            {
                protocol: 'https',
                hostname: 'static.wikia.nocookie.net',
            },
            {
                protocol: 'https',
                hostname: 'static0.thegamerimages.com',
            },
            {
                protocol: 'https',
                hostname: 'www.dexerto.com',
            },
            {
                protocol: 'https',
                hostname: 'comicbook.com',
            },
            {
                protocol: 'https',
                hostname: 'www.pokemon.com',
            },
            {
                protocol: 'https',
                hostname: 'media.tenor.com',
            },
            {
                protocol: 'https',
                hostname: 'i.ytimg.com',
            },
        ],
        dangerouslyAllowSVG: true
    }
});
