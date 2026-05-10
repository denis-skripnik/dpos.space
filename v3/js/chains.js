(function exposeChains(global) {
  'use strict';

  const profileApp = {
    id: 'profiles',
    title: 'Профили',
    description: 'Read-only просмотр основных данных аккаунта через публичные API.'
  };

  const chains = {
    golos: {
      id: 'golos',
      title: 'Golos',
      description: 'DPoS блокчейн с постами, комментариями и донатами.',
      defaultAccount: 'denis-skripnik',
      libraryGlobal: 'golos',
      libraryPath: 'blockchains/golos/js/golos.min.js',
      nodes: [
        'https://golosapi.ecurrex.ru',
        'https://api.aleksw.space',
        'https://golos.lexai.top',
        'https://api-full.golos.id',
        'https://api-golos.blckchnd.com'
      ],
      apps: [profileApp]
    },
    viz: {
      id: 'viz',
      title: 'VIZ',
      description: 'DPoS блокчейн с награждением кого угодно за что угодно.',
      defaultAccount: 'denis-skripnik',
      libraryGlobal: 'viz',
      libraryPath: 'blockchains/viz/js/viz.min.js',
      nodes: [
        'https://viz.lexai.host/',
        'https://api.viz.world/',
        'https://node.viz.cx'
      ],
      apps: [profileApp]
    },
    steem: {
      id: 'steem',
      title: 'Steem',
      description: 'DPoS медиа-блокчейн: блоги и вознаграждение за лайки.',
      defaultAccount: 'denis-skripnik',
      libraryGlobal: 'steem',
      libraryPath: 'blockchains/steem/js/steem.min.js',
      nodes: [
        'https://api.steemit.com'
      ],
      apps: [profileApp]
    },
    hive: {
      id: 'hive',
      title: 'Hive',
      description: 'DPoS медиа-блокчейн: блоги и вознаграждение за лайки.',
      defaultAccount: 'denis-skripnik',
      libraryGlobal: 'hive',
      libraryPath: 'blockchains/hive/js/hive.min.js',
      nodes: [
        'https://rpc.usehive.com',
        'https://api.hive.blog',
        'https://anyx.io'
      ],
      apps: [profileApp]
    }
  };

  global.DposChains = Object.freeze(chains);
})(window);
