(function exposeHistory(global) {
  'use strict';

  const operationLists = {
    // Keep every chain explicit. Some lists match today (Steem/Hive), but each chain can diverge independently.
    golos: ['vote', 'comment', 'content_mentions', 'comment_mention', 'transfer', 'transfer_to_vesting', 'withdraw_vesting', 'limit_order_create', 'limit_order_cancel', 'feed_publish', 'convert', 'account_create', 'account_update', 'witness_update', 'account_witness_vote', 'account_witness_proxy', 'custom', 'delete_comment', 'custom_json', 'comment_options', 'set_withdraw_vesting_route', 'limit_order_create2', 'request_account_recovery', 'recover_account', 'change_recovery_account', 'escrow_transfer', 'escrow_dispute', 'escrow_release', 'escrow_approve', 'transfer_to_savings', 'transfer_from_savings', 'cancel_transfer_from_savings', 'custom_binary', 'decline_voting_rights', 'reset_account', 'set_reset_account', 'delegate_vesting_shares', 'account_create_with_delegation', 'account_metadata', 'proposal_create', 'proposal_update', 'proposal_delete', 'chain_properties_update', 'break_free_referral', 'delegate_vesting_shares_with_interest', 'reject_vesting_shares_delegation', 'transit_to_cyberway', 'worker_request', 'worker_request_delete', 'worker_request_vote', 'fill_convert_request', 'author_reward', 'curation_reward', 'comment_reward', 'interest', 'fill_vesting_withdraw', 'fill_order', 'shutdown_witness', 'fill_transfer_from_savings', 'hardfork', 'comment_payout_update', 'comment_benefactor_reward', 'return_vesting_delegation', 'producer_reward', 'delegation_reward', 'auction_window_reward'],
    viz: ['transfer', 'transfer_to_vesting', 'withdraw_vesting', 'account_update', 'witness_update', 'account_witness_vote', 'account_witness_proxy', 'custom', 'set_withdraw_vesting_route', 'request_account_recovery', 'recover_account', 'change_recovery_account', 'escrow_transfer', 'escrow_dispute', 'escrow_release', 'escrow_approve', 'delegate_vesting_shares', 'account_create', 'account_metadata', 'proposal_create', 'proposal_update', 'proposal_delete', 'fill_vesting_withdraw', 'shutdown_witness', 'return_vesting_delegation', 'committee_worker_create_request', 'committee_worker_cancel_request', 'committee_vote_request', 'committee_cancel_request', 'committee_approve_request', 'committee_payout_request', 'committee_pay_request', 'witness_reward', 'create_invite', 'claim_invite_balance', 'invite_registration', 'versioned_chain_properties_update', 'award', 'fixed_award', 'receive_award', 'benefactor_award', 'set_paid_subscription', 'paid_subscribe', 'paid_subscription_action', 'cancel_paid_subscription', 'set_account_price', 'set_subaccount_price', 'buy_account', 'account_sale', 'use_invite_balance', 'expire_escrow_ratification', 'target_account_sale', 'bid', 'outbid'],
    steem: ['vote', 'comment', 'transfer', 'transfer_to_vesting', 'withdraw_vesting', 'limit_order_create', 'limit_order_cancel', 'feed_publish', 'convert', 'account_create', 'account_update', 'witness_update', 'account_witness_vote', 'account_witness_proxy', 'custom', 'delete_comment', 'custom_json', 'comment_options', 'set_withdraw_vesting_route', 'limit_order_create2', 'request_account_recovery', 'recover_account', 'change_recovery_account', 'escrow_transfer', 'escrow_dispute', 'escrow_release', 'escrow_approve', 'transfer_to_savings', 'transfer_from_savings', 'cancel_transfer_from_savings', 'custom_binary', 'decline_voting_rights', 'reset_account', 'set_reset_account', 'delegate_vesting_shares', 'account_create_with_delegation', 'account_metadata', 'proposal_create', 'proposal_update', 'proposal_delete', 'chain_properties_update', 'fill_convert_request', 'author_reward', 'curation_reward', 'comment_reward', 'interest', 'fill_vesting_withdraw', 'fill_order', 'shutdown_witness', 'fill_transfer_from_savings', 'hardfork', 'producer_reward'],
    minter: ['send', 'delegate', 'unbond', 'sell', 'sell_swap_pool', 'add_liquidity', 'remove_liquidity', 'create_coin', 'mint_token', 'burn_token'],
    decimal: ['send', 'delegate', 'unbond', 'create_token', 'transfer_token', 'nft'],
    hive: ['vote', 'comment', 'transfer', 'transfer_to_vesting', 'withdraw_vesting', 'limit_order_create', 'limit_order_cancel', 'feed_publish', 'convert', 'account_create', 'account_update', 'witness_update', 'account_witness_vote', 'account_witness_proxy', 'custom', 'delete_comment', 'custom_json', 'comment_options', 'set_withdraw_vesting_route', 'limit_order_create2', 'request_account_recovery', 'recover_account', 'change_recovery_account', 'escrow_transfer', 'escrow_dispute', 'escrow_release', 'escrow_approve', 'transfer_to_savings', 'transfer_from_savings', 'cancel_transfer_from_savings', 'custom_binary', 'decline_voting_rights', 'reset_account', 'set_reset_account', 'delegate_vesting_shares', 'account_create_with_delegation', 'account_metadata', 'proposal_create', 'proposal_update', 'proposal_delete', 'chain_properties_update', 'fill_convert_request', 'author_reward', 'curation_reward', 'comment_reward', 'interest', 'fill_vesting_withdraw', 'fill_order', 'shutdown_witness', 'fill_transfer_from_savings', 'hardfork', 'producer_reward']
  };

  const operationLabels = {
    golos: {
      vote: 'Голосование по контенту', comment: 'Публикация контента', transfer: 'Перевод средств', transfer_to_vesting: 'Перевод в СГ', withdraw_vesting: 'Вывод из СГ', limit_order_create: 'Создание лимитного ордера', limit_order_cancel: 'Отмена лимитного ордера', feed_publish: 'Публикация фидов', convert: 'Конвертация GOLOS в GBG или обратно', account_create: 'Создание аккаунта', account_update: 'Обновление акккаунта', witness_update: 'Обновление делегата', account_witness_vote: 'Голосование за делегата', account_witness_proxy: 'Прокси голосования за делегатов', custom: 'Custom транзакция', delete_comment: 'Удаление контента', custom_json: 'Транзакция с JSON данными', comment_options: 'Опции контента', set_withdraw_vesting_route: 'Направление вывода в СГ', limit_order_create2: 'Создание лимитного ордера 2', request_account_recovery: 'запрос восстановления аккаунта', recover_account: 'Восстановление аккаунта', change_recovery_account: 'Смена аккаунта восстановления', escrow_transfer: 'Сделка через посредника', escrow_dispute: 'Спорная ситуация в escrow', escrow_release: 'отпустить токены из escrow сделки', escrow_approve: 'Подтверждение escrow сделки', transfer_to_savings: 'Перевод в сейф', transfer_from_savings: 'Перевод из сейфа', cancel_transfer_from_savings: 'Отмена перевода из сейфа', custom_binary: 'custom транзакция с бинарными данными', decline_voting_rights: 'Отказ от прав на голосование', reset_account: 'Восстановление аккаунта', set_reset_account: 'Учетная запись имеет право выполнить операцию reset_account по истечении 60 дней', delegate_vesting_shares: 'Делегирование СГ', account_create_with_delegation: 'Создание аккаунта с делегированием СГ', account_metadata: 'Обновление мета данных аккаунта', proposal_create: 'Создание пропозала на подпись', proposal_update: 'Обновление пропозала на подпись', proposal_delete: 'Удаление пропозала на подпись', chain_properties_update: 'Обновление параметров сети', break_free_referral: 'Отмена реферальских комиссии', delegate_vesting_shares_with_interest: 'Делегирование СГ с возвратом кураторских', reject_vesting_shares_delegation: 'Отклонение делегирования СГ', transit_to_cyberway: 'Переход на Cyberway', worker_request: 'Создание заявки воркера', worker_request_delete: 'Удаление заявки воркера', worker_request_vote: 'Голосование за заявку воркера', fill_convert_request: 'Завершение заявки на конвертацию', author_reward: 'Авторская награда', curation_reward: 'Кураторская награда', comment_reward: 'Общая награда за контент', interest: 'Выплата процента прибыли по GBG', fill_vesting_withdraw: 'Завершение вывода из СГ', fill_order: 'Исполнение ордера', shutdown_witness: 'Отключение делегата', fill_transfer_from_savings: 'Завершение вывода из сейфа', hardfork: 'Хардфорк', comment_payout_update: 'Вычисленные окончательные выплаты по контенту', comment_benefactor_reward: 'Бенефициарская награда', return_vesting_delegation: 'Возврат делегированной доли', producer_reward: 'Награда делегата', delegation_reward: 'Награда с делегирования', auction_window_reward: 'Возврат токенов в пул вознаграждений'
    },
    steem: {
      vote: 'Голосование по контенту', comment: 'Публикация контента', transfer: 'Перевод средств', transfer_to_vesting: 'Перевод в SP', withdraw_vesting: 'Вывод из SP', limit_order_create: 'Создание лимитного ордера', limit_order_cancel: 'Отмена лимитного ордера', feed_publish: 'Публикация фидов', convert: 'Конвертация STEEM в SBD или обратно', account_create: 'Создание аккаунта', account_update: 'Обновление акккаунта', witness_update: 'Обновление делегата', account_witness_vote: 'Голосование за делегата', account_witness_proxy: 'Прокси голосования за делегатов', custom: 'Custom транзакция', delete_comment: 'Удаление контента', custom_json: 'Транзакция с JSON данными', comment_options: 'Опции контента', set_withdraw_vesting_route: 'Направление вывода в SP', limit_order_create2: 'Создание лимитного ордера 2', request_account_recovery: 'запрос восстановления аккаунта', recover_account: 'Восстановление аккаунта', change_recovery_account: 'Смена аккаунта восстановления', escrow_transfer: 'Сделка через посредника', escrow_dispute: 'Спорная ситуация в escrow', escrow_release: 'отпустить токены из escrow сделки', escrow_approve: 'Подтверждение escrow сделки', transfer_to_savings: 'Перевод в сейф', transfer_from_savings: 'Перевод из сейфа', cancel_transfer_from_savings: 'Отмена перевода из сейфа', custom_binary: 'custom транзакция с бинарными данными', decline_voting_rights: 'Отказ от прав на голосование', reset_account: 'Восстановление аккаунта', set_reset_account: 'Учетная запись имеет право выполнить операцию reset_account по истечении 60 дней', delegate_vesting_shares: 'Делегирование SP', account_create_with_delegation: 'Создание аккаунта с делегированием SP', account_metadata: 'Обновление мета данных аккаунта', proposal_create: 'Создание пропозала на подпись', proposal_update: 'Обновление пропозала на подпись', proposal_delete: 'Удаление пропозала на подпись', chain_properties_update: 'Обновление параметров сети', fill_convert_request: 'Завершение заявки на конвертацию', author_reward: 'Авторская награда', curation_reward: 'Кураторская награда', comment_reward: 'Общая награда за контент', interest: 'Выплата процента прибыли по SBD', fill_vesting_withdraw: 'Завершение вывода из SP', fill_order: 'Исполнение ордера', shutdown_witness: 'Отключение делегата', fill_transfer_from_savings: 'Завершение вывода из сейфа', hardfork: 'Хардфорк', producer_reward: 'Награда делегата'
    },
    hive: {
      vote: 'Голосование по контенту', comment: 'Публикация контента', transfer: 'Перевод средств', transfer_to_vesting: 'Перевод в HP', withdraw_vesting: 'Вывод из HP', limit_order_create: 'Создание лимитного ордера', limit_order_cancel: 'Отмена лимитного ордера', feed_publish: 'Публикация фидов', convert: 'Конвертация HIVE в HBD', account_create: 'Создание аккаунта', account_update: 'Обновление акккаунта', witness_update: 'Обновление делегата', account_witness_vote: 'Голосование за делегата', account_witness_proxy: 'Прокси голосования за делегатов', custom: 'Custom транзакция', delete_comment: 'Удаление контента', custom_json: 'Транзакция с JSON данными', comment_options: 'Опции контента', set_withdraw_vesting_route: 'Направление вывода в HP', limit_order_create2: 'Создание лимитного ордера 2', request_account_recovery: 'запрос восстановления аккаунта', recover_account: 'Восстановление аккаунта', change_recovery_account: 'Смена аккаунта восстановления', escrow_transfer: 'Сделка через посредника', escrow_dispute: 'Спорная ситуация в escrow', escrow_release: 'отпустить токены из escrow сделки', escrow_approve: 'Подтверждение escrow сделки', transfer_to_savings: 'Перевод в сейф', transfer_from_savings: 'Перевод из сейфа', cancel_transfer_from_savings: 'Отмена перевода из сейфа', custom_binary: 'custom транзакция с бинарными данными', decline_voting_rights: 'Отказ от прав на голосование', reset_account: 'Восстановление аккаунта', set_reset_account: 'Учетная запись имеет право выполнить операцию reset_account по истечении 60 дней', delegate_vesting_shares: 'Делегирование HP', account_create_with_delegation: 'Создание аккаунта с делегированием HP', account_metadata: 'Обновление мета данных аккаунта', proposal_create: 'Создание пропозала на подпись', proposal_update: 'Обновление пропозала на подпись', proposal_delete: 'Удаление пропозала на подпись', chain_properties_update: 'Обновление параметров сети', fill_convert_request: 'Завершение заявки на конвертацию', author_reward: 'Авторская награда', curation_reward: 'Кураторская награда', comment_reward: 'Общая награда за контент', interest: 'Выплата процента прибыли по HBD', fill_vesting_withdraw: 'Завершение вывода из HP', fill_order: 'Исполнение ордера', shutdown_witness: 'Отключение делегата', fill_transfer_from_savings: 'Завершение вывода из сейфа', hardfork: 'Хардфорк', producer_reward: 'Награда делегата'
    }
  };

  const walletOps = {
    golos: new Set([
      'transfer', 'transfer_to_vesting', 'withdraw_vesting', 'transfer_from_tip', 'transfer_to_tip', 'donate', 'claim',
      'delegate_vesting_shares', 'delegate_vesting_shares_with_interest', 'delegation_reward',
      'curation_reward', 'author_reward', 'comment_benefactor_reward', 'producer_reward', 'fill_order'
    ]),
    viz: new Set([
      'transfer', 'transfer_to_vesting', 'withdraw_vesting', 'delegate_vesting_shares',
      'award', 'receive_award', 'benefactor_award', 'witness_reward', 'committee_pay_request'
    ]),
    steem: new Set([
      'transfer', 'transfer_to_vesting', 'withdraw_vesting', 'curation_reward', 'author_reward',
      'comment_benefactor_reward', 'producer_reward', 'fill_order'
    ]),
    minter: new Set(['send', 'delegate', 'unbond', 'sell', 'sell_swap_pool', 'add_liquidity', 'remove_liquidity', 'create_coin', 'mint_token', 'burn_token']),
    decimal: new Set(['send', 'delegate', 'unbond', 'create_token', 'transfer_token', 'nft']),
    hive: new Set([
      'transfer', 'transfer_to_vesting', 'withdraw_vesting', 'curation_reward', 'author_reward',
      'comment_benefactor_reward', 'producer_reward', 'fill_order'
    ])
  };

  const opNames = {
    account_create: 'Создание аккаунта',
    account_metadata: 'Обновление метаданных',
    account_update: 'Обновление аккаунта',
    account_witness_proxy: 'Прокси делегатского голоса',
    account_witness_vote: 'Голос за делегата',
    author_reward: 'Авторская награда',
    award: 'Награда',
    benefactor_award: 'Бенефициарская награда',
    buy_coin: 'Покупка монет',
    COIN_BUY: 'Покупка монет',
    claim: 'Получение награды',
    comment_benefactor_reward: 'Бенефициарская награда',
    create_coin: 'Создание монеты',
    COIN_CREATE: 'Создание монеты',
    create_token: 'Создание токена',
    create_transaction: 'Создание мультисиг транзакции',
    MULTISIG_CREATE_TX: 'Создание мультисиг транзакции',
    create_wallet: 'Создание мультисига',
    MULTISIG_CREATE_WALLET: 'Создание мультисига',
    curation_reward: 'Кураторская награда',
    declare_candidate: 'Объявление кандидата в валидаторы',
    VALIDATOR_DECLARE_CANDIDATE: 'Объявление кандидата в валидаторы',
    delegate: 'Делегирование',
    COIN_DELEGATE: 'Делегирование',
    VALIDATOR_DELEGATE: 'Делегирование',
    delegate_nft: 'Делегирование NFT',
    NFT_DELEGATE: 'Делегирование NFT',
    delegate_vesting_shares: 'Делегирование доли',
    edit_candidate: 'Редактирование кандидата',
    VALIDATOR_EDIT_CANDIDATE: 'Редактирование кандидата',
    fill_order: 'Исполнение ордера',
    issue_check: 'Создание чека',
    CHECK_ISSUE: 'Создание чека',
    mint_nft: 'Создание NFT',
    NFT_MINT: 'Создание NFT',
    multisend_coin: 'Мультисенд (мульти-отправка)',
    COIN_MULTISEND: 'Мультисенд (мульти-отправка)',
    receive_award: 'Получение награды',
    redeem_check: 'Получение чека',
    CHECK_REDEEM: 'Получение чека',
    sell_all_coin: 'Продажа всех монет',
    COIN_SELL_ALL: 'Продажа всех монет',
    sell_coin: 'Продажа монеты',
    COIN_SELL: 'Продажа монеты',
    send: 'Отправка',
    send_coin: 'Отправка',
    COIN_SEND: 'Отправка',
    set_offline: 'Установка кандидата в статусе оффлайн',
    VALIDATOR_SET_OFFLINE: 'Установка кандидата в статусе оффлайн',
    set_online: 'Установка кандидата в статусе онлайн',
    VALIDATOR_SET_ONLINE: 'Установка кандидата в статусе онлайн',
    sign_transaction: 'Подпись мультисигом транзакции',
    MULTISIG_SIGN_TX: 'Подпись мультисигом транзакции',
    transfer: 'Перевод',
    transfer_from_savings: 'Перевод из сбережений',
    transfer_from_tip: 'Перевод из tip-баланса',
    transfer_nft: 'Передача NFT',
    NFT_TRANSFER: 'Передача NFT',
    transfer_to_savings: 'Перевод в сбережения',
    transfer_to_tip: 'Перевод в tip-баланс',
    transfer_to_vesting: 'Перевод в соцкапитал',
    content_mentions: 'Упоминание в контенте',
    comment_mention: 'Упоминание в комментарии',
    unbond: 'Анбонд',
    VALIDATOR_UNBOND: 'Анбонд',
    unbond_nft: 'Анбонд NFT',
    NFT_UNBOND: 'Анбонд NFT',
    update_coin: 'Обновление монеты',
    COIN_UPDATE: 'Обновление монеты',
    withdraw_vesting: 'Вывод соцкапитала',
    witness_reward: 'Награда делегата',
    witness_update: 'Обновление делегата',
    custom: 'Кастомный JSON',
    set_withdraw_vesting_route: 'Установка направления вывода',
    request_account_recovery: 'Запрос восстановления',
    recover_account: 'Восстановление аккаунта',
    change_recovery_account: 'Смена доверенного аккаунта',
    escrow_transfer: 'Сделка через посредника',
    escrow_dispute: 'Спорная ситуация в escrow',
    escrow_release: 'Отпустить токены из escrow сделки',
    escrow_approve: 'Подтверждение escrow сделки',
    proposal_create: 'Создание предложения на подпись',
    proposal_update: 'Обновление предложения на подпись',
    proposal_delete: 'Удаление предложения на подпись',
    fill_vesting_withdraw: 'Конвертация в VIZ (Shares)',
    shutdown_witness: 'Отключение делегата',
    return_vesting_delegation: 'Возврат делегированной доли',
    committee_worker_create_request: 'Создание заявки комитета',
    committee_worker_cancel_request: 'Отмена заявки в комитете',
    committee_vote_request: 'Голосование за заявку',
    committee_cancel_request: 'Заявка отклонена комитетом',
    committee_approve_request: 'Одобрение заявки',
    committee_payout_request: 'Заявка полностью получила выплату из комитета',
    committee_pay_request: 'Заявка получила выплату из комитета',
    create_invite: 'Создание инвайт-кода',
    claim_invite_balance: 'Погашение инвайт-кода',
    invite_registration: 'Регистрация по инвайту',
    versioned_chain_properties_update: 'Установка делегатом голосуемых параметров сети',
    fixed_award: 'Фиксированная награда',
    set_paid_subscription: 'Установка подписки',
    paid_subscribe: 'Подписка',
    paid_subscription_action: 'Оплата периодических платежей',
    cancel_paid_subscription: 'Отмена подписки',
    set_account_price: 'Установка цены аккаунта',
    set_subaccount_price: 'Установка цены сабаккаунта',
    buy_account: 'Покупка аккаунта',
    account_sale: 'Продажа аккаунта',
    use_invite_balance: 'Использование инвайта на баланс',
    expire_escrow_ratification: 'Истечение срока ратификации escrow',
    target_account_sale: 'Установка покупателя аккаунта',
    bid: 'Ставка на покупку аккаунта',
    outbid: 'Ставка на покупку аккаунта перебита',
    '/decimal.coin.v1.MsgBuyCoin': 'Конвертация',
    '/decimal.coin.v1.MsgMultiSendCoin': 'Мультисенд (мульти-отправка)',
    '/decimal.coin.v1.MsgSellAllCoin': 'Конвертация',
    '/decimal.coin.v1.MsgSellCoin': 'Конвертация',
    '/decimal.coin.v1.MsgSendCoin': 'Отправка',
    '/decimal.validator.v1.MsgDeclareCandidate': 'Объявление кандидата в валидаторы',
    '/decimal.validator.v1.MsgDelegateCoin': 'Делегирование',
    '/decimal.validator.v1.MsgSetOffline': 'Установка кандидата в статусе оффлайн',
    '/decimal.validator.v1.MsgSetOnline': 'Установка кандидата в статусе онлайн',
    '/decimal.validator.v1.MsgUndelegateCoin': 'Анбонд',
    '/decimal.validator.v1.MsgEditCandidate': 'Редактирование кандидата',
    '/decimal.multisig.v1.MsgCreateWallet': 'Создание мультисига',
    '/decimal.multisig.v1.MsgCreateTransaction': 'Создание мультисиг транзакции',
    '/decimal.multisig.v1.MsgSignTransaction': 'Подпись мультисигом транзакции',
    '/decimal.nft.v1.MsgMintToken': 'Создание NFT',
    '/decimal.nft.v1.MsgBurnToken': 'Сжигание NFT',
    '/decimal.nft.v1.MsgEditMetadata': 'Редактирование мета-данных NFT',
    '/decimal.nft.v1.MsgTransferToken': 'Передача NFT',
    '/decimal.nft.v1.MsgDelegateToken': 'Делегирование NFT',
    '/decimal.nft.v1.MsgUndelegateToken': 'Анбонд NFT',
    MsgSubmitProposal: 'Отправленный пропозал',
    MsgVote: 'Голосование по пропозалу',
    msg_burn: 'Сжигание NFT',
    NFT_BURN: 'Сжигание NFT',
    msg_edit_metadata: 'Редактирование мета-данных NFT',
    NFT_EDIT_METADATA: 'Редактирование мета-данных NFT',
    msg_initialize: 'Инициализация свопа',
    msg_mint: 'Создание NFT',
    msg_redeem_v2: 'Получение свопа',
    msg_transfer: 'Передача NFT',
    1: 'Отправка',
    2: 'Продажа монеты',
    3: 'Продажа всех монет',
    4: 'Покупка монет',
    5: 'Создание монеты',
    6: 'Объявление кандидата в валидаторы',
    7: 'Делегирование',
    8: 'Анбонд',
    9: 'Получение чека',
    10: 'Установка кандидата в статусе онлайн',
    11: 'Установка кандидата в статусе оффлайн',
    12: 'Создание мультисига',
    13: 'Мультисенд (мульти-отправка)',
    14: 'Редактирование кандидата',
    15: 'Установка блока остановки',
    16: 'Пересоздание монеты',
    17: 'Изменение владельца монеты',
    18: 'Редактирование мультисига',
    19: 'Голосование за цену',
    20: 'Изменение публичного ключа кандидата',
    21: 'Добавление ликвидности',
    22: 'Удаление ликвидности',
    23: 'Продажа через пул',
    24: 'Покупка через пул',
    25: 'Продажа всех монет через пул',
    26: 'Изменение комиссии кандидата',
    27: 'Перемещение стейка',
    28: 'Эмиссия токена',
    29: 'Сжигание токена',
    30: 'Создание токена',
    31: 'Пересоздание токена',
    32: 'Голосование за комиссию',
    33: 'Голосование за обновление',
    34: 'Создание пула ликвидности',
    35: 'Добавление лимитного ордера',
    36: 'Удаление лимитного ордера',
    37: 'Блокировка стейка',
    38: 'Блокировка токенов',
    39: 'Перенос стейка'
  };

  function callApi(chain, method, args) {
    const api = chain.client && chain.client.api;
    const asyncName = `${method}Async`;

    if (!api) {
      return Promise.reject(new Error('Библиотека Blockchain API недоступна.'));
    }

    if (typeof api[asyncName] === 'function') {
      return api[asyncName](...args);
    }

    if (typeof api[method] === 'function') {
      return new Promise((resolve, reject) => {
        api[method](...args, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
      });
    }

    return Promise.reject(new Error(`Метод API ${method} недоступен.`));
  }

  async function fetchAccountHistory(chain, accountName, options = {}) {
    const limit = Math.max(1, Math.min(Number(options.limit) || 100, 1000));
    const from = Number.isFinite(Number(options.from)) ? Number(options.from) : -1;
    const selectedOps = Array.isArray(options.ops) ? options.ops.filter(Boolean) : [];
    const args = [accountName, from, limit];

    if (chain.config.id === 'golos' && selectedOps.length > 0) {
      args.push({ select_ops: selectedOps });
    }

    if (chain.config.id === 'minter') {
      const response = await fetch(`${chain.config.explorerBase}/addresses/${encodeURIComponent(accountName)}/transactions?page=1`);
      if (!response.ok) throw new Error(`Minter history API HTTP ${response.status}`);
      const data = await response.json();
      return normalizeRestHistory(data.data || data.transactions || []);
    }
    if (chain.config.id === 'decimal') {
      const offset = Number.isFinite(Number(options.offset)) ? Number(options.offset) : 0;
      const response = await fetch(`${chain.config.apiBase}/txs/txs-by-address/${encodeURIComponent(accountName)}?limit=${limit}&offset=${offset}`);
      if (!response.ok) throw new Error(`Decimal history API HTTP ${response.status}`);
      const data = await response.json();
      return normalizeRestHistory(unwrapRestHistory(data));
    }

    const raw = await callApi(chain, 'getAccountHistory', args);
    const normalized = normalizeHistory(raw);

    return selectedOps.length > 0 && chain.config.id !== 'golos'
      ? normalized.filter((item) => selectedOps.includes(item.type))
      : normalized;
  }

  function normalizeHistory(raw) {
    if (!Array.isArray(raw)) return [];

    return raw.map((item) => {
      const index = item[0];
      const body = item[1] || {};
      const op = body.op || [];
      return {
        index,
        type: op[0] || 'unknown',
        data: op[1] || {},
        timestamp: body.timestamp || '',
        trxId: body.trx_id || '',
        block: body.block || body.block_num || body.blockNumber || '',
        raw: item
      };
    }).sort((a, b) => {
      if (a.timestamp === b.timestamp) return Number(b.index) - Number(a.index);
      return String(b.timestamp).localeCompare(String(a.timestamp));
    });
  }

  function unwrapRestHistory(raw) {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== 'object') return [];
    const candidates = [
      raw.txs,
      raw.transactions,
      raw.result && raw.result.txs,
      raw.result && raw.result.Txs,
      raw.Result && raw.Result.txs,
      raw.Result && raw.Result.Txs,
      raw.result,
      raw.Result,
      raw.data && raw.data.txs,
      raw.data && raw.data.transactions,
      raw.data
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
    return [];
  }

  function normalizeRestHistory(raw) {
    const rows = unwrapRestHistory(raw);
    if (!Array.isArray(rows)) return [];
    return rows.map((item, index) => ({
      index,
      type: item.type || item.tx_type || item.transaction_type || item.message_type || 'transaction',
      data: item.data || item.message || item,
      timestamp: item.timestamp || item.time || item.created_at || '',
      trxId: item.hash || item.tx_hash || item.id || '',
      block: item.block || item.block_id || item.blockId || item.block_number || item.height || '',
      raw: item
    }));
  }

  function isWalletOperation(chain, item) {
    const set = walletOps[chain.id] || new Set(['transfer']);
    const data = item.data || {};
    return set.has(item.type) || Boolean(data.from && data.to && data.amount);
  }

  function getWalletOperations(chain, items) {
    return items.filter((item) => isWalletOperation(chain, item));
  }

  function operationTitle(type) {
    if (type === null || typeof type === 'undefined' || type === '') return '';
    if (opNames[type]) return opNames[type];
    const numeric = Number(type);
    if (Number.isFinite(numeric) && opNames[numeric]) return opNames[numeric];
    if (typeof type === 'string' && /^0x[0-9a-f]+$/i.test(type)) {
      const fromHex = Number.parseInt(type, 16);
      if (opNames[fromHex]) return opNames[fromHex];
    }
    return String(type);
  }

  function operationOptions(chain) {
    const chainId = chain && (chain.id || (chain.config && chain.config.id));
    const list = operationLists[chainId] || [];
    const labels = operationLabels[chainId] || {};
    return list.map((value) => ({ value, label: labels[value] || operationTitle(value) }));
  }

  function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(`${timestamp}.000Z`);
    if (Number.isNaN(date.getTime())) return timestamp;
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function isMinimalUnitKey(key) {
    return /(^|_)(value|amount|stake|liquidity|volume|balance|reserve|supply)(_|$)/i.test(String(key || ''));
  }

  function formatMinimalUnits(value) {
    const text = String(value || '').trim();
    if (!/^\d+$/.test(text) || text.length < 19) return text;
    const whole = text.slice(0, -18) || '0';
    const fraction = text.slice(-18).replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : whole;
  }

  function formatChainAmount(chain, key, value) {
    if (!chain || !['minter', 'decimal'].includes(chain.id || (chain.config && chain.config.id))) return formatValue(value);
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') return formatValue(value);
    const text = String(value).trim();
    if (text.includes('.') || !isMinimalUnitKey(key)) return text;
    return formatMinimalUnits(text);
  }

  function formatValue(value) {
    if (value === null || typeof value === 'undefined') return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  global.DposHistory = Object.freeze({
    fetchAccountHistory,
    formatChainAmount,
    formatDate,
    formatMinimalUnits,
    formatValue,
    normalizeRestHistory,
    getWalletOperations,
    operationOptions,
    operationTitle
  });
})(window);
