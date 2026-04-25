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
            {
                protocol: 'https',
                hostname: 'img.jakpost.net',
            },
            {
                protocol: 'https',
                hostname: 'miro.medium.com',
            },
            {
                protocol: 'https',
                hostname: 'www.ujungkulon.net',
            },
            {
                protocol: 'https',
                hostname: 'thesevenseas.net',
            },
            {
                protocol: 'https',
                hostname: 'www.indonesia.travel',
            },
            {
                protocol: 'https',
                hostname: 'upload.wikimedia.org',
            },
            {
                protocol: 'https',
                hostname: 'www.regent-holidays.co.uk',
            },
            {
                protocol: 'https',
                hostname: 'a-z-animals.com',
            },
            {
                protocol: 'https',
                hostname: 'p.potaufeu.asahi.com',
            },
            {
                protocol: 'https',
                hostname: 'www.medibank.com.au',
            },
            {
                protocol: 'https',
                hostname: 'brazilgreentravel.com',
            },
            {
                protocol: 'https',
                hostname: 'cdn.wisemove.ca',
            },
            {
                protocol: 'https',
                hostname: 'j6m3f5v5.delivery.rocketcdn.me',
            },
            {
                protocol: 'https',
                hostname: 'images.christineabroad.com',
            },
            {
                protocol: 'https',
                hostname: 'www.machutravelperu.com',
            },
            {
                protocol: 'https',
                hostname: 'cheetahsafaris.com',
            },
            {
                protocol: 'https',
                hostname: 'encrypted-tbn0.gstatic.com',
            },
            {
                protocol: 'https',
                hostname: 'cdn.kimkim.com',
            },
            {
                protocol: 'https',
                hostname: 's7g10.scene7.com',
            },
            {
                protocol: 'https',
                hostname: 'a.storyblok.com',
            },
            {
                protocol: 'https',
                hostname: 'cdn-imgix.headout.com',
            },
            {
                protocol: 'https',
                hostname: 'www.outlooktravelmag.com',
            },
            {
                protocol: 'https',
                hostname: 'www.nwf.org',
            },
            {
                protocol: 'https',
                hostname: 'chameleons101.com',
            },
            {
                protocol: 'https',
                hostname: 'plunketts.net',
            },
            {
                protocol: 'https',
                hostname: 'd4g0cdul6yygp.cloudfront.net',
            },
            {
                protocol: 'https',
                hostname: 'www.worldatlas.com',
            },
            {
                protocol: 'https',
                hostname: 'blog.padi.com',
            },
            {
                protocol: 'https',
                hostname: 'www.goeco.org',
            },
            {
                protocol: 'https',
                hostname: 'media.gadventures.com',
            },
            {
                protocol: 'https',
                hostname: 'www.campervaniceland.com',
            },
            {
                protocol: 'https',
                hostname: 'www.visitdubai.com',
            },
            {
                protocol: 'https',
                hostname: 'www.leonetwork.org',
            },
            {
                protocol: 'https',
                hostname: 'www.envpk.com',
            },
            {
                protocol: 'https',
                hostname: 'cdn.britannica.com',
            },
            {
                protocol: 'https',
                hostname: 'www.balitecturerealty.com',
            },
        ],
        dangerouslyAllowSVG: true
    }
});
