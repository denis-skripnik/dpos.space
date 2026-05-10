(function exposeChains(global) {
  'use strict';

  const baseApps = [
    {
      id: 'profiles',
      title: 'Профили',
      description: 'Read-only просмотр основных данных аккаунта через публичные API.'
    },
    {
      id: 'accounts',
      title: 'Аккаунты',
      description: 'Совместимый просмотр и выбор аккаунтов из legacy localStorage.'
    },
    {
      id: 'wallet',
      title: 'Кошелёк',
      description: 'Баланс, финансовая история, preview и real broadcast операций.'
    },
    {
      id: 'history',
      title: 'История',
      description: 'Read-only история операций аккаунта.'
    },
    {
      id: 'broadcast',
      title: 'Broadcast',
      description: 'Проверка legacy-ключей, preview и real broadcast операций.'
    }
  ];

  const vizApps = [
    { id: 'award', title: 'Award', description: 'VIZ-награды: award/fixedAward через regular authority.' },
    { id: 'registration', title: 'Регистрация', description: 'VIZ invite registration через explicit signer WIF input без hardcoded ключей.' },
    { id: 'calculator', title: 'Калькулятор', description: 'Калькулятор VIZ/SHARES/энергии.' },
    { id: 'manage', title: 'Управление', description: 'Manage-сервисы: proxy, witness vote, профиль, воркеры, multisig.' },
    { id: 'explorer', title: 'Explorer', description: 'Read-only explorer helpers.' }
  ];

  const golosApps = [
    { id: 'editor', title: 'Редактор', description: 'Публикация постов через posting authority.' },
    { id: 'calculator', title: 'Калькулятор', description: 'Калькулятор GOLOS/GBG/СГ.' },
    { id: 'donate', title: 'Донат', description: 'Golos donate через posting authority.' },
    { id: 'import', title: 'Импорт статьи', description: 'Каркас импорта статьи перед публикацией.' },
    { id: 'escrow', title: 'Escrow', description: 'Escrow оставлен read-only/optional: старый flow крупный и не входит в текущие обязательные пункты.' },
    { id: 'instant-view', title: 'Instant View', description: 'Каркас instant view.' },
    { id: 'manage', title: 'Управление', description: 'Manage-сервисы: proxy, witness vote, profile/witness settings.' },
    { id: 'swap', title: 'Swap', description: 'Каркас DEX/swap операций.' },
    { id: 'register', title: 'Регистрация', description: 'Golos invite registration через explicit service signer WIF input без hardcoded ключей.' },
    { id: 'explorer', title: 'Explorer', description: 'Read-only explorer helpers.' }
  ];

  const socialApps = [
    { id: 'editor', title: 'Редактор', description: 'Публикация постов через posting authority.' },
    { id: 'calculator', title: 'Калькулятор', description: 'HP/SP и vesting estimation.' },
    { id: 'manage', title: 'Управление', description: 'Manage-сервисы: proxy, witness vote, profile/witness settings.' },
    { id: 'register', title: 'Регистрация', description: 'Каркас account creation.' },
    { id: 'import', title: 'Импорт статьи', description: 'Каркас импорта/instant view для постов.' },
    { id: 'instant-view', title: 'Instant View', description: 'Каркас instant view для постов.' },
    { id: 'swap', title: 'Swap', description: 'Каркас market/swap операций.' },
    { id: 'explorer', title: 'Explorer', description: 'Read-only explorer helpers.' }
  ];


  const minterApps = [
    { id: 'validators', title: 'Валидаторы', description: 'Read-only список валидаторов и формы delegate/unbond.' },
    { id: 'explorer', title: 'Explorer', description: 'Read-only address/tx/block explorer через публичный API.' },
    { id: 'swap', title: 'Swap', description: 'Minter sell/swap-pool operations через SDK.' },
    { id: 'my-coin', title: 'Мои монеты', description: 'Create/recreate token, mint/burn/edit owner where SDK supports it.' },
    { id: 'calculator', title: 'Калькулятор', description: 'Калькулятор swap route/amount и local random-block helper.' },
    { id: 'randomblockchain', title: 'Random blockchain', description: 'Генератор случайного числа по двум блокам.' },
    { id: 'long', title: 'LONG', description: 'Legacy LONG сервисы отмечены как external/backend-dependent; wallet send memo поддержан.' }
  ];

  const decimalApps = [
    { id: 'validators', title: 'Валидаторы', description: 'Read-only валидаторы и delegate/unbond DEL/token/NFT.' },
    { id: 'explorer', title: 'Explorer', description: 'Read-only address/tx/block explorer через Decimal API.' },
    { id: 'swap', title: 'Swap', description: 'Decimal SDK token conversion where SDK exposes methods.' },
    { id: 'my-coin', title: 'Монеты/NFT', description: 'Create token and NFT delegation flows where SDK exposes methods.' },
    { id: 'calculator', title: 'Калькулятор', description: 'DEL/token amount helper.' }
  ];

  function apps(extraApps) {
    return baseApps.concat(extraApps || []);
  }

  const chains = {
    golos: {
      id: 'golos',
      title: 'Golos',
      description: 'DPoS блокчейн с постами, комментариями и донатами.',
      defaultAccount: 'denis-skripnik',
      libraryGlobal: 'golos',
      libraryPath: 'blockchains/golos/js/golos.min.js',
      cryptoPath: 'blockchains/golos/js/sjcl.min.js',
      liquidSymbol: 'GOLOS',
      debtSymbol: 'GBG',
      vestingSymbol: 'GESTS',
      powerTitle: 'СГ',
      nodes: [
        'https://golosapi.ecurrex.ru',
        'https://api.aleksw.space',
        'https://golos.lexai.top',
        'https://api-full.golos.id',
        'https://api-golos.blckchnd.com'
      ],
      apps: apps(golosApps)
    },
    viz: {
      id: 'viz',
      title: 'VIZ',
      description: 'DPoS блокчейн с награждением кого угодно за что угодно.',
      defaultAccount: 'denis-skripnik',
      libraryGlobal: 'viz',
      libraryPath: 'blockchains/viz/js/viz.min.js',
      cryptoPath: 'blockchains/viz/js/sjcl.min.js',
      liquidSymbol: 'VIZ',
      vestingSymbol: 'SHARES',
      powerTitle: 'SHARES',
      nodes: [
        'https://api.viz.world/',
        'https://viz.lexai.host/',
        'https://node.viz.cx'
      ],
      apps: apps(vizApps)
    },
    steem: {
      id: 'steem',
      title: 'Steem',
      description: 'DPoS медиа-блокчейн: блоги и вознаграждение за лайки.',
      defaultAccount: 'denis-skripnik',
      libraryGlobal: 'steem',
      libraryPath: 'blockchains/steem/js/steem.min.js',
      cryptoPath: 'blockchains/steem/js/sjcl.min.js',
      liquidSymbol: 'STEEM',
      debtSymbol: 'SBD',
      vestingSymbol: 'VESTS',
      powerTitle: 'SP',
      nodes: [
        'https://api.steemit.com'
      ],
      apps: apps(socialApps)
    },
    hive: {
      id: 'hive',
      title: 'Hive',
      description: 'DPoS медиа-блокчейн: блоги и вознаграждение за лайки.',
      defaultAccount: 'denis-skripnik',
      libraryGlobal: 'hive',
      libraryPath: 'blockchains/hive/js/hive.min.js',
      cryptoPath: 'blockchains/hive/js/sjcl.min.js',
      liquidSymbol: 'HIVE',
      debtSymbol: 'HBD',
      vestingSymbol: 'VESTS',
      powerTitle: 'HP',
      nodes: [
        'https://rpc.usehive.com',
        'https://api.hive.blog',
        'https://anyx.io'
      ],
      apps: apps(socialApps)
    },
    minter: {
      id: 'minter',
      title: 'Minter',
      description: 'Minter blockchain: адреса, кошелёк, валидаторы, монеты и swap.',
      defaultAccount: 'Mx0000000000000000000000000000000000000000',
      libraryGlobal: 'minterSDK',
      libraryPath: 'blockchains/minter/js/minterjs-sdk.min.js',
      walletPath: 'blockchains/minter/js/minterjs-wallet.min.js',
      cryptoPath: 'blockchains/minter/js/sjcl.min.js',
      apiBase: 'https://api.minter.one/v2',
      explorerBase: 'https://explorer-api.minter.network/api/v2',
      liquidSymbol: 'BIP',
      vestingSymbol: 'BIP',
      addressPrefix: 'Mx',
      validatorPrefix: 'Mp',
      nodes: ['https://api.minter.one/v2'],
      apps: apps(minterApps)
    },
    decimal: {
      id: 'decimal',
      title: 'Decimal',
      description: 'Decimal Chain: адреса, кошелёк, валидаторы, монеты, NFT и swap.',
      defaultAccount: 'dx0000000000000000000000000000000000000000',
      libraryGlobal: 'DecimalSDK',
      libraryPath: 'blockchains/decimal/js/decimal-sdk-web.js',
      cryptoPath: 'blockchains/decimal/js/sjcl.min.js',
      apiBase: 'https://api.decimalchain.com/api/v1',
      liquidSymbol: 'DEL',
      vestingSymbol: 'DEL',
      addressPrefix: 'dx',
      apps: apps(decimalApps)
    }
  };

  global.DposChains = Object.freeze(chains);
})(window);
