(function exposeChains(global) {
  'use strict';

  const baseApps = [
    {
      id: 'profiles',
      title: 'Профили',
      accountField: true,
      description: 'Просмотр основных данных аккаунта через публичные API без отправки операций.'
    },
    {
      id: 'accounts',
      title: 'Аккаунты',
      description: 'Просмотр и выбор сохранённых аккаунтов браузера.'
    },
    {
      id: 'wallet',
      title: 'Кошелёк',
      accountField: true,
      description: 'Баланс, финансовая история, проверка и отправка операций.'
    },
    {
      id: 'history',
      title: 'История',
      accountField: true,
      description: 'История операций аккаунта без отправки операций.'
    },
    {
      id: 'broadcast',
      title: 'Отправка',
      description: 'Проверка доступности ключей и отправка операций.'
    }
  ];

  const vizApps = [
    { id: 'award', title: 'Награды', description: 'VIZ-награды: операции award/fixedAward через regular authority.' },
    { id: 'registration', title: 'Регистрация', description: 'VIZ invite registration через explicit signer WIF input без hardcoded ключей.' },
    { id: 'calculator', title: 'Калькулятор', description: 'Калькулятор VIZ/SHARES/энергии.' },
    { id: 'manage', title: 'Управление', description: 'Сервисы управления: proxy, witness vote, профиль, воркеры, multisig.' },
    { id: 'explorer', title: 'Проводник', description: 'Просмотр данных блокчейна без отправки операций.' },
    { id: 'exchanges', title: 'Обмен VIZ', description: 'Ссылки и инструкции по покупке/продаже VIZ.' }
  ];

  const golosApps = [
    { id: 'editor', title: 'Редактор', description: 'Публикация постов через posting authority.' },
    { id: 'calculator', title: 'Калькулятор', description: 'Калькулятор GOLOS/GBG/СГ.' },
    { id: 'donate', title: 'Донат', description: 'Golos donate через posting authority.' },
    { id: 'import', title: 'Импорт статьи', description: 'Каркас импорта статьи перед публикацией.' },
    { id: 'escrow', title: 'Escrow', description: 'Escrow оставлен только для просмотра/опционально: старый flow крупный и не входит в текущие обязательные пункты.' },
    { id: 'instant-view', title: 'Instant View', description: 'Каркас быстрого просмотра.' },
    { id: 'manage', title: 'Управление', description: 'Сервисы управления: proxy, witness vote, настройки профиля/witness.' },
    { id: 'swap', title: 'Обмен', description: 'Каркас DEX/swap операций.' },
    { id: 'register', title: 'Регистрация', description: 'Golos invite registration через explicit service signer WIF input без hardcoded ключей.' },
    { id: 'explorer', title: 'Проводник', description: 'Просмотр данных блокчейна без отправки операций.' }
  ];

  const socialApps = [
    { id: 'editor', title: 'Редактор', description: 'Публикация постов через posting authority.' },
    { id: 'calculator', title: 'Калькулятор', description: 'HP/SP и vesting estimation.' },
    { id: 'manage', title: 'Управление', description: 'Сервисы управления: proxy, witness vote, настройки профиля/witness.' },
    { id: 'register', title: 'Регистрация', description: 'Каркас account creation.' },
    { id: 'import', title: 'Импорт статьи', description: 'Каркас импорта/instant view для постов.' },
    { id: 'instant-view', title: 'Instant View', description: 'Каркас быстрого просмотра для постов.' },
    { id: 'swap', title: 'Обмен', description: 'Каркас market/swap операций.' },
    { id: 'explorer', title: 'Проводник', description: 'Просмотр данных блокчейна без отправки операций.' }
  ];


  const minterApps = [
    { id: 'validators', title: 'Валидаторы', description: 'Просмотр списка валидаторов и формы делегирования/анбонда.' },
    { id: 'explorer', title: 'Проводник', description: 'Просмотр адресов, транзакций и блоков через публичный API.' },
    { id: 'swap', title: 'Обмен', description: 'Обмен монет и операции swap-pool.' },
    { id: 'my-coin', title: 'Мои монеты', description: 'Создание, выпуск, сжигание токенов и смена владельца.' },
    { id: 'calculator', title: 'Калькулятор', description: 'Калькулятор маршрута обмена и сумм.' },
    { id: 'randomblockchain', title: 'Случайный блокчейн', description: 'Генератор случайного числа по двум блокам.' },
    { id: 'long', title: 'LONG', description: 'LONG-сервисы и отправка memo для операций кошелька.' }
  ];

  const decimalApps = [
    { id: 'validators', title: 'Валидаторы', description: 'Просмотр валидаторов и делегирование/анбонд DEL/token/NFT.' },
    { id: 'explorer', title: 'Проводник', description: 'Просмотр адресов, транзакций и блоков через Decimal API.' },
    { id: 'swap', title: 'Обмен', description: 'Конвертация токенов Decimal.' },
    { id: 'my-coin', title: 'Монеты/NFT', description: 'Создание токенов и операции с NFT.' },
    { id: 'calculator', title: 'Калькулятор', description: 'Помощник расчёта суммы DEL/token.' }
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
      libraryPath: 'v3/vendor/golos/golos.min.js',
      cryptoPath: 'v3/vendor/golos/sjcl.min.js',
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
      libraryPath: 'v3/vendor/viz/viz.min.js',
      cryptoPath: 'v3/vendor/viz/sjcl.min.js',
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
      libraryPath: 'v3/vendor/steem/steem.min.js',
      cryptoPath: 'v3/vendor/steem/sjcl.min.js',
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
      libraryPath: 'v3/vendor/hive/hive.min.js',
      cryptoPath: 'v3/vendor/hive/sjcl.min.js',
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
      libraryPath: 'v3/vendor/minter/minterjs-sdk.min.js',
      walletPath: 'v3/vendor/minter/minterjs-wallet.min.js',
      cryptoPath: 'v3/vendor/minter/sjcl.min.js',
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
      libraryPath: 'v3/vendor/decimal/decimal-sdk-web.js',
      cryptoPath: 'v3/vendor/decimal/sjcl.min.js',
      apiBase: 'https://api.decimalchain.com/api/v1',
      liquidSymbol: 'DEL',
      vestingSymbol: 'DEL',
      addressPrefix: 'dx',
      apps: apps(decimalApps)
    }
  };

  global.DposChains = Object.freeze(chains);
})(window);
