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
    { id: 'notifications', title: 'Уведомления', description: 'Локальная панель входящих VIZ-событий из account_history: награды, переводы и ответы без backend.', accountField: true },
    { id: 'award', title: 'Награды', description: 'VIZ-награды: операции award/fixedAward через regular authority.' },
    { id: 'registration', title: 'Регистрация', description: 'VIZ invite registration через explicit signer WIF input без hardcoded ключей.' },
    { id: 'calculator', title: 'Калькулятор', description: 'Калькулятор VIZ/SHARES/энергии.' },
    { id: 'analytics', title: 'Аналитика', description: 'Read-only VIZ analytics dashboards by inov8 via public Yandex DataLens embeds/links.' },
    { id: 'custom-generator', title: 'JSON-генератор', description: 'Генератор VIZ custom_json: локальная проверка JSON и отправка custom через общий подтверждаемый broadcast flow.', accountField: false },
    { id: 'polls', title: 'Опросы', description: 'VIZ polls: static-safe формы протокола viz-votes для createVote/voteing плюс документация backend-only списка/результатов.', accountField: false },
    { id: 'projects', title: 'Проекты', description: 'VIZ projects: static-safe paid transfer forms for viz-projects protocol plus documentation of backend-only catalog/task/news indexer.', accountField: false },
    { id: 'top', title: 'Топ пользователей', description: 'Локальная загрузка топа VIZ через публичный RPC: SHARES, VIZ, делегации и вывод без backend-индексера.', accountField: false },
    { id: 'witnesses-rewards', title: 'Награды валидаторов', description: 'Список валидаторов VIZ через публичный RPC и документация legacy reward-колонок за текущий/предыдущий день и месяц без старого backend.', accountField: false },
    { id: 'randomblockchain', title: 'Случайный блокчейн', description: 'Детерминированный random по validator_signature/witness_signature двух публичных блоков VIZ.' },
    { id: 'search', title: 'Viz-links', description: 'Поиск и добавление viz-links: backend search index documented, add-link award protocol kept static-safe.' },
    { id: 'voice-import', title: 'Импорт в Voice', description: 'Импорт Telegra.ph/Mirror-like текста в Voice/readdle.me через static-safe custom protocol V без legacy proxy.' },
    { id: 'vmp', title: 'Шлюз в Minter', description: 'VMP gateway: ссылки на пулы VIZCHAIN и клиентский расчёт фарминга через публичные VIZ/Minter API.', accountField: false },
    { id: 'manage', title: 'Управление', description: 'Сервисы управления: proxy, validator vote, профиль, воркеры, multisig.' },
    { id: 'explorer', title: 'Проводник', description: 'Просмотр данных блокчейна без отправки операций.' },
    { id: 'exchanges', title: 'Обмен VIZ', description: 'Ссылки и инструкции по покупке/продаже VIZ.' },
    { id: 'help', title: 'Справка', description: 'Справка dpos.space/VIZ как явная статическая ссылка вместо legacy auto-redirect.' }
  ];

  const golosApps = [
    { id: 'editor', title: 'Редактор', description: 'Публикация постов через posting authority.' },
    { id: 'notifications', title: 'Уведомления', description: 'Локальная панель непрочитанных Golos-событий из get_account_history без backend.', accountField: true },
    { id: 'feeds', title: 'Ленты', description: 'Golos ленты: новое, популярное, донаты и подписки пользователя через публичный RPC; лайк/репост/донат с подтверждением.', accountField: true },
    { id: 'auto-upvoter', title: 'Автоапвоутер', description: 'Локальный браузерный автоапвоутер Golos: пока сайт открыт, использует сохранённый posting-ключ для автоматического vote/donate без backend.' },
    { id: 'post', title: 'Пост', description: 'Просмотр поста Golos, Markdown, комментарии, ответы, голосование и донаты через posting authority.', accountField: false },
    { id: 'calculator', title: 'Калькулятор', description: 'Калькулятор GOLOS/GBG/СГ.' },
    { id: 'donate', title: 'Донат', description: 'Golos donate через posting authority.' },
    { id: 'top', title: 'Топ пользователей', description: 'Локальная загрузка топа Golos через публичный RPC: СГ, GOLOS, GBG, TIP и UIA без backend-индексера.', accountField: false },
    { id: 'witnesses-rewards', title: 'Делегаты', description: 'Актуальный список делегатов Golos через публичный RPC без legacy reward-агрегатов.', accountField: false },
    { id: 'randomblockchain', title: 'Случайный блокчейн', description: 'Детерминированный random по двум публичным блокам Golos.' },
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
    { id: 'feeds', title: 'Ленты', description: 'Новые, популярные, блог аккаунта и лента подписок через публичный Hive/Steem RPC; лайк/репост с подтверждением.', accountField: true },
    { id: 'post', title: 'Пост', description: 'Просмотр поста, Markdown, комментарии, ответы и голосование через posting authority.', accountField: false },
    { id: 'auto-upvoter', title: 'Автоапвоутер', description: 'Локальный браузерный автоапвоутер Hive/Steem: пока сайт открыт, использует сохранённый posting-ключ для автоматического vote без backend и без донатов.' },
    { id: 'calculator', title: 'Калькулятор', description: 'HP/SP и vesting estimation.' },
    { id: 'manage', title: 'Управление', description: 'Сервисы управления: proxy, witness vote, настройки профиля/witness.' },
    { id: 'register', title: 'Регистрация', description: 'Каркас account creation.' },
    { id: 'import', title: 'Импорт статьи', description: 'Каркас импорта/instant view для постов.' },
    { id: 'instant-view', title: 'Instant View', description: 'Каркас быстрого просмотра для постов.' },
    { id: 'swap', title: 'Обмен', description: 'Каркас market/swap операций.' },
    { id: 'randomblockchain', title: 'Случайный блокчейн', description: 'Генератор случайного числа по witness_signature двух публичных блоков.' },
    { id: 'explorer', title: 'Проводник', description: 'Просмотр данных блокчейна без отправки операций.' }
  ];

  const steemApps = socialApps.concat([
    { id: 'backup', title: 'Бекап постов', description: 'Локальный экспорт публичных Steem-постов через public RPC без backend-архива и без ключей.', accountField: true },
    { id: 'help', title: 'Справка', description: 'Явная ссылка на legacy Steem обзор сервисов dpos.space без auto-redirect.', accountField: false }
  ]);

  const hiveApps = socialApps.concat([
    { id: 'backup', title: 'Бекап постов', description: 'Локальный экспорт публичных Hive-постов через public RPC без backend-архива, оплаты и ключей.', accountField: true }
  ]);

  const minterApps = [
    { id: 'validators', title: 'Валидаторы', description: 'Просмотр списка валидаторов и формы делегирования/анбонда.' },
    { id: 'explorer', title: 'Проводник', description: 'Просмотр адресов, транзакций и блоков через публичный API.' },
    { id: 'help', title: 'Справка', description: 'Видео-справка Minter dpos.space без PHP/backend runtime.', accountField: false },
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
    { id: 'calculator', title: 'Калькулятор', description: 'Помощник расчёта суммы DEL/token.' },
    { id: 'randomblockchain', title: 'Случайный блокчейн', description: 'Генератор случайного числа по Decimal block hash двух публичных блоков.' }
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
      dexPath: 'v3/vendor/golos/golos-dex.min.js',
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
      randomHashPath: 'v3/vendor/viz/sha3.min.js',
      liquidSymbol: 'VIZ',
      vestingSymbol: 'SHARES',
      powerTitle: 'SHARES',
      nodes: [
        'https://api.viz.world',
        'https://node.viz.cx'
      ],
      testnet: {
        nodes: [
          'https://testnet.viz.world/'
        ]
      },
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
      randomHashPath: 'v3/vendor/viz/sha3.min.js',
      liquidSymbol: 'STEEM',
      debtSymbol: 'SBD',
      vestingSymbol: 'VESTS',
      powerTitle: 'SP',
      nodes: [
        'https://api.steemit.com'
      ],
      apps: apps(steemApps)
    },
    hive: {
      id: 'hive',
      title: 'Hive',
      description: 'DPoS медиа-блокчейн: блоги и вознаграждение за лайки.',
      defaultAccount: 'denis-skripnik',
      libraryGlobal: 'hive',
      libraryPath: 'v3/vendor/hive/hive.min.js',
      cryptoPath: 'v3/vendor/hive/sjcl.min.js',
      randomHashPath: 'v3/vendor/viz/sha3.min.js',
      liquidSymbol: 'HIVE',
      debtSymbol: 'HBD',
      vestingSymbol: 'VESTS',
      powerTitle: 'HP',
      nodes: [
        'https://rpc.usehive.com',
        'https://api.hive.blog',
        'https://anyx.io'
      ],
      apps: apps(hiveApps)
    },
    minter: {
      id: 'minter',
      title: 'Minter',
      description: 'Minter blockchain: адреса, кошелёк, валидаторы, монеты и swap.',
      defaultAccount: 'Mxf85ceccfe2112e88be58162c43f5ec959672ab54',
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
      gateUrl: 'https://mainnet-gate.decimalchain.com/api/',
      liquidSymbol: 'DEL',
      vestingSymbol: 'DEL',
      addressPrefix: 'dx',
      apps: apps(decimalApps)
    }
  };

  global.DposChains = Object.freeze(chains);
})(window);
