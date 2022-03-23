<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'serey/accounts" target="_blank">здесь</a></p></div>                        
                        <div id="active_auth_msg" style="display: none;"><p>Вы не ввели активный ключ. Пожалуйста удалите текущий аккаунт и авторизуйтесь с указанием и регулярного, и активного ключа, здесь: <a href="'.$conf['siteUrl'].'serey/accounts" target="_blank">здесь</a></p></div>
<div id="active_page">
<div id="main_wallet_info" style="display: none;">
<p>Баланс: <a class="tt" onclick="spoiler(`hive_actions`, `walletSpoiler`); return false"><span class="hive_balance"></span> SEREY</a> и <a class="tt" onclick="spoiler(`sp_actions`, `walletSpoiler`); return false"><span class="hive_vesting_shares"></span> SP</a></p>
<ul id="hive_actions" class="terms walletSpoiler" style="display: none;"><li><a data-fancybox data-src="#hive_transfer_modal" href="javascript:;">Перевести hive</a></li>
<li><a data-fancybox data-src="#to_shares_transfer_modal" href="javascript:;">SEREY в SP этого аккаунта</a></li>
<li><a href="'.$conf['siteUrl'].'serey/swap">Обменять SEREY</a></li></ul>
<ul id="sp_actions" class="terms walletSpoiler" style="display: none;"><li><a data-fancybox data-src="#vesting_withdraw_modal" href="javascript:;">Вывод SP в hive</a></li>
<li><a data-fancybox data-src="#vesting_delegate_modal" href="javascript:;">Делегировать SP</a></li></ul>
<div style="display: none;" id="vesting_withdraw_modal">
                                                      <h4 class="modal-title">Вывод SP в hive</h4>
                                                      <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                <div id="action_vesting_withdraw">
                                                <p><strong>Предупреждение: если у вас сейчас уже есть вывод, отправка этой формы сбросит сумму на вывод.</strong></p>
                                                <form class="form" name="postForm">
                                                <p><label for="vesting_withdraw_amount">Сумма на вывод (<span id="max_vesting_withdraw">Вывести все доступные <span id="max_vesting_withdraw_result"></span> SP</span>):</label></p>
                                                <p><input type="text" name="vesting_withdraw_amount" id="action_vesting_withdraw_amount" placeholder="1.000000"></p>
                                                 <p><input type="button" id="action_vesting_withdraw_start" value="Начать вывод"></p>
                                                </form>
                                                </div>
                                                      </div>
                                                      <div style="display: none;" id="hive_transfer_modal">
                                                      <h4 class="modal-title">Перевод SEREY на другой аккаунт</h4>
                                                      <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                      <div id="action_hive_transfer">
                                                <form class="form" name="postForm">
                                                <p><label for="hive_transfer_to">Кому:</label></p>
                                                <p><input type="text" name="hive_transfer_to" id="action_hive_transfer_to" placeholder="Введите получателя"></p>
                                                 <p><label for="hive_transfer_amount">Сумма перевода (<span id="max_vesting_transfer">Перевести все доступные <span class="hive_balance"></span> hive</span>):</label></p>
                                                <p><input type="text" name="hive_transfer_amount" id="action_hive_transfer_amount" placeholder="1.000"></p>
                                                <p><label for="hive_transfer_memo">Заметка (описание) к платежу:</label></p>
                                                <p><input type="text" name="hive_transfer_memo" id="action_hive_transfer_memo" placeholder="Введите memo"></p>
                                                <p><input type="checkbox" id="transfer_to_vesting"> Перевести в SP</p>
                                                 <p><input type="button" id="action_hive_transfer_start" value="Перевести"></p>
                                                </form>
                                                      </div>
                                                      </div>
                                                      <div style="display: none;" id="to_shares_transfer_modal">
                                                      <h4 class="modal-title">Перевод SEREY в SP этого аккаунта</h4>
                                                      <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                      <div id="action_to_shares_transfer"><form class="form" name="postForm">
                                                 <p><label for="to_shares_transfer_amount">Количество SEREY (<span id="max_to_shares_transfer">Все доступные <span class="hive_balance"></span> SEREY</span>):</label></p>
                                                <p><input type="text" name="to_shares_transfer_amount" id="action_to_shares_transfer_amount" placeholder="1.000"></p>
                                                 <p><input type="button" id="action_to_shares_transfer_start" value="Начать перевод"></p>
                                                </form></div>
                                                      </div>
                                                      <div style="display: none;" id="vesting_delegate_modal">
                                                      <h4 class="modal-title">Делегирование SP</h4>
                                                      <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                <div id="action_vesting_delegate"><form class="form" name="postForm">
                                                <p><label for="vesting_delegate_to">Кому:</label></p>
                                                <p><input type="text" name="vesting_delegate_to" id="action_vesting_delegate_to" placeholder="Введите получателя"></p>
                                                 <p><label for="vesting_delegate_amount">Сумма делегирования (<span id="max_vesting_delegate">Делегировать все доступные <span id="max_vesting_deligate"></span> SP</span>):</label></p>
                                                <p><input type="text" name="vesting_delegate_amount" id="action_vesting_delegate_amount" placeholder="1.000000"></p>
                                                 <p><input type="button" id="action_vesting_delegate_start" value="делегировать"></p>
                                                </form></div>
                                                      </div>
<div id="claim" style="display: none;"><hr>
<p>К получению: <span id="claim_balances"></span></p>
<p><strong><input type="button" id="claim_action" value="Получить"></strong></p><hr></div>
<div><p>Делегировали другие пользователи вам <span class="received_vesting_shares_result"></span></p>
                                                <p>Делегировано другим пользователям (Без учёта отменённого) <a data-fancybox data-src="#modal_delegated_vesting_shares" href="javascript:;"><span class="delegated_vesting_shares_result"></span></a></p>
                                                <div style="display: none;" id="modal_delegated_vesting_shares">
                                                <h4 class="modal-title">Список аккаунтов, которым вы делегировали  Power</h4>
                                                <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                <table id="body_delegated_vesting_shares"><tr><th>Логин</th><th>Сумма</th><th>Мин. время возврата делегирования</th><th>Отменить делегирование</th></tr></table>
                                                      </div>
                                                <p>Ваша доля (С учётом полученного и переданного), которая влияет на силу апвотов и флагов: <span id="full_vesting"></span> SP</p>
                                                
                                                <div id="info_vesting_withdraw" style="display: none;"><p>Выводится по <span id="vesting_withdraw_rate"></span> SP 13 недель</p>
                                                <p>Следующий вывод: <span id="next_vesting_withdrawal"></span></p>
                                                <p>В конечном итоге вы выведите <span id="full_vesting_withdraw"></span></p>
                                                <p><input type="button" id="cancel_vesting_withdraw" value="Отменить вывод SP"></p></div>
                                                                                                </div>
                                                
                                                <div id="wallet_transfer_history" style="display: none;">
                                                <h2>История переводов средств</h2>
                                                <p>Совет: нажмите на кнопку "Ещё" несколько раз (чем больше, тем лучше): будет больше шанс, что среди кучи операций попадётся нужная вам - сможете отобразить их.</p>
                                                <div id="filtrs"><p><span id="all_transfers" align="left">Все</span> <span id="get_transfers" align="center">Входящие</span> <span id="send_transfers" align="right">Исходящие</span></p>
                                                <p><span id="author_reward" align="left">Авторские награды</span> <span id="curator_reward" align="right">Кураторские награды</span></p>
                                          <p><span id="witness_reward" align="left">Награды делегату</span> <span id="benefactor_reward" align="right">Бенефициарские награды</span></p>
                                          </div>
                                                                                            <table><thead><th>Дата и время платежа</th>
                                                <th>От кого</th>
                                                <th>Кому</th>
                                                <th>Сумма</th>
                                                <th>memo (Заметка)</th></thead>
                                                <tbody  id="transfer_history_tbody"></tbody></table>
                                                <button id="wallet-data-button" onclick="walletData()">Ещё</button></div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>																																

<script>
walletData();
</script>
'; ?>