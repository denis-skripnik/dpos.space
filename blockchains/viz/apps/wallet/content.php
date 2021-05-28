<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">здесь</a></p></div>                        
                        <div id="active_auth_msg" style="display: none;"><p>Вы не ввели активный ключ. Пожалуйста удалите текущий аккаунт и авторизуйтесь с указанием и регулярного, и активного ключа, здесь: <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">здесь</a></p></div>
												<div id="active_page">
                        <div id="main_wallet_info" style="display: none;">
                        <h2>Балансы пользователя <span id="username"></span></h2>
                        <p>Баланс: <a class="tt" onclick="spoiler(`balance_actions`, `walletSpoiler`); return false"><span class="viz_balance"></span> VIZ</a>, социальный капитал: <a class="tt" onclick="spoiler(`shares_actions`, `walletSpoiler`); return false"><span class="viz_vesting_shares"></span> Ƶ</a></p>
                                                <ul id="balance_actions" class="terms walletSpoiler" style="display: none;"><li><a data-fancybox data-src="#viz_transfer_modal" href="javascript:;" onclick="getTransferTemplates();">Перевести viz</a></li>
                                                <li><a data-fancybox data-src="#to_shares_transfer_modal" href="javascript:;">viz в соц. капитал этого аккаунта</a></li>
                                                <li><a data-fancybox data-src="#create_invite_form_modal" href="javascript:;">Создать инвайт-код</a></li>
<li><a data-fancybox data-src="#viz_diposit_modal" href="javascript:;">Пополнить счёт</a></li>
</ul>
<ul id="shares_actions" class="terms walletSpoiler" style="display: none;"><li><a data-fancybox data-src="#vesting_withdraw_modal" href="javascript:;">Вывод соц. капитал в viz</a></li>
                                                <li><a data-fancybox data-src="#vesting_delegate_modal" href="javascript:;">Делегировать</a></li>
</ul>
<div style="display: none;" id="viz_diposit_modal">
<h4 class="modal-title">Пополнение счёта вашего аккаунта в viz</h4>
<p><button data-fancybox-close class="btn">Закрыть</button></p>
<p><strong>Пополнение производится с использованием инвайт-кодов. Получить за фиат или криптовалюту их вы сможете, обратившись к пользователям viz, например, к создателю liveblogs.</strong></p>
<div id="action_vesting_diposit">
<form class="form" name="postForm">
<p><label for="invite_secret">Инвайт-код (Начинается с 5):</label></p>
<p><input type="text" name="invite_secret" id="invite_secret" placeholder="5K..." onchange="getInviteWithForm()"></p>
<p id="invite_code_data"></p>                                                
<p><label for="to_shares">Перевести в соц.  капитал: 
                                                      <input type="checkbox" name="to_shares" id="to_shares" placeholder="Перевести в соц. капитал"></label></p>
                                                <p><input type="button" id="action_vesting_diposit_start" value="Пополнить"></p>
                                                </form>
                                                      </div>
                                                      </div>
                                                      <div style="display: none;" id="vesting_withdraw_modal">
                                                      <h4 class="modal-title">Вывод SHARES в viz</h4>
                                                      <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                <div id="action_vesting_withdraw">
                                                <p><strong>Предупреждение: если у вас сейчас уже есть вывод, отправка этой формы сбросит сумму на вывод.</strong></p>
                                                <form class="form" name="postForm">
                                                <p><label for="vesting_withdraw_amount">Сумма на вывод (<span id="max_vesting_withdraw">Вывести все доступные <span id="max_vesting_withdraw_result"></span> SHARES</span>):</label></p>
                                                <p><input type="text" name="vesting_withdraw_amount" id="action_vesting_withdraw_amount" placeholder="1.000000"></p>
                                                 <p><input type="button" id="action_vesting_withdraw_start" value="Начать вывод"></p>
                                                </form>
                                                </div>
                                                      </div>
                                                      <div style="display: none;" id="viz_transfer_modal">
                                                      <h4 class="modal-title">Перевод viz на другой аккаунт</h4>
                                                      <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                      <div id="action_viz_transfer">
                                                <form class="form" name="postForm">
                                                <p><label for="transfer_template">Выберите шаблон перевода:</label></p>
<p><select name="transfer_template" id="select_transfer_template">
<option value="">Выберите шаблон (данные будут установлены в поля при выборе)</option>
<option value="xchng_market">Биржа, XCHNG.VIZ (В заметке введите логин после log:)</option>
<option value="golos_xchng_market">VIZUIA на Голосе (В заметке введите Golos логин после log:)</option>
<option value="gph_xchng_market">Graphene биржа, XCHNG.VIZ (В заметке введите GPH логин после log:)</option>
<option value="vmp_market">Шлюз в Minter (введите адрес в Minter после Mx, не включая начальные символы, или просто скопируйте адрес и замените всё)</option>
</select> <span style="display: none;" id="remove_transfer_template">(<input type="button" value="Удалить текущий шаблон" onclick="removeTransferTemplate(this.form.transfer_template.value)">)</span> </p>
<p><label for="viz_transfer_to">Кому:</label></p>
                                                <p><input type="text" name="viz_transfer_to" id="action_viz_transfer_to" placeholder="Введите получателя"></p>
                                                 <p><label for="viz_transfer_amount">Сумма перевода (<span id="max_vesting_transfer">Перевести все доступные <span class="viz_balance"></span> viz</span>):</label></p>
                                                <p><input type="text" name="viz_transfer_amount" id="action_viz_transfer_amount" placeholder="1.000"></p>
                                                <p><label for="viz_transfer_memo">Заметка (описание) к платежу:</label></p>
                                                <p><input type="text" name="viz_transfer_memo" id="action_viz_transfer_memo" placeholder="Введите memo"></p>
                                                <p><input type="checkbox" id="transfer_to_vesting"> Перевести в SHARES</p>
                                                 <p><input type="button" id="action_viz_transfer_start" value="Перевести"></p>
                                                <hr>
                                                <p><input type="button" id="action_save_transfer_template" value="Создать шаблон перевода"></p>
                                                 </form>
                                                      </div>
                                                      </div>
                                                      <div style="display: none;" id="to_shares_transfer_modal">
                                                      <h4 class="modal-title">Перевод viz в SHARES этого аккаунта</h4>
                                                      <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                      <div id="action_to_shares_transfer"><form class="form" name="postForm">
                                                 <p><label for="to_shares_transfer_amount">Количество viz (<span id="max_to_shares_transfer">Все доступные <span class="viz_balance"></span> viz</span>):</label></p>
                                                <p><input type="text" name="to_shares_transfer_amount" id="action_to_shares_transfer_amount" placeholder="1.000"></p>
                                                 <p><input type="button" id="action_to_shares_transfer_start" value="Начать перевод"></p>
                                                </form></div>
                                                      </div>
                                                      <div style="display: none;" id="vesting_delegate_modal">
                                                      <h4 class="modal-title">Делегирование SHARES</h4>
                                                      <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                <div id="action_vesting_delegate"><form class="form" name="postForm">
                                                <p><label for="vesting_delegate_to">Кому:</label></p>
                                                <p><input type="text" name="vesting_delegate_to" id="action_vesting_delegate_to" placeholder="Введите получателя"></p>
                                                 <p><label for="vesting_delegate_amount">Сумма делегирования (<span id="max_vesting_delegate">Делегировать все доступные <span id="max_vesting_deligate"></span> SHARES</span>):</label></p>
                                                <p><input type="text" name="vesting_delegate_amount" id="action_vesting_delegate_amount" placeholder="1.000000"></p>
                                                 <p><input type="button" id="action_vesting_delegate_start" value="делегировать"></p>
                                                </form></div>
                                                      </div>
<div style="display: none;" id="create_invite_form_modal">
<h4 class="modal-title">Создание инвайта</h4>
<p><button data-fancybox-close class="btn">Закрыть</button></p>
<p>Инвайты могут использоваться при регистрации и для перевода в баланс</p>
<div id="create_invite"><form class="form" name="postForm">
<p><label for="create_invite_balance">Баланс инвайта (<span id="max_invite_balance">В баланс инвайта все доступные <span class="viz_balance"></span> viz</span>):</label></p>
<p><input type="text" name="create_invite_balance" id="create_invite_amount" placeholder="1.000"></p>
<p><label for="create_invite_key">Инвайт-код:</label></p>
<p><input type="button" value="Генерировать" id="new_private_gen"><br>
<input type="text" name="create_invite_key" id="create_invite_key" readonly placeholder="Сгенерируйте инвайт-код"><br>
<input type="button" id="new_private_copy" value="Скопировать в буфер обмена"></p>
<p><input type="button" id="create_invite_start" value="Создать инвайт"></p>
</form>
<div id="invite_created" style="display: none;"><h2>Инвайт-код успешно создан</h2>
<ul><li>Инвайд-код: <span id="create_private_invite_key_result"></span> </li><li>Баланс: <span id="create_invite_result_amount"></span></li></ul></div>
</div>
</div>
                                                <div><p>Делегировали другие пользователи вам <a data-fancybox data-src="#modal_received_vesting_shares" href="javascript:;"><span class="received_vesting_shares_result"></span> Ƶ</a></p>
                                                <div style="display: none;" id="modal_received_vesting_shares">
                                                <h4 class="modal-title">Список аккаунтов, которые делегировали SHARES этому пользователю</h4>
                                                <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                <table id="body_received_vesting_shares"><tr><th>Логин</th><th>Сумма</th><th>Мин. время возврата делегирования</th></tr></table>
                                                      </div>
                                                <p>Делегировано другим пользователям (Без учёта отменённого) <a data-fancybox data-src="#modal_delegated_vesting_shares" href="javascript:;"><span class="delegated_vesting_shares_result"></span></a> Ƶ</p>
                                                <div style="display: none;" id="modal_delegated_vesting_shares">
                                                <h4 class="modal-title">Список аккаунтов, которым вы делегировали SHARES</h4>
                                                <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                <table id="body_delegated_vesting_shares"><tr><th>Логин</th><th>Сумма</th><th>Мин. время возврата делегирования</th><th>Отменить делегирование</th></tr></table>
                                                      </div>
                                                <p>Ваш соц. капитал (с учётом полученного и переданного), который влияет на награды: <span id="full_vesting"></span> Ƶ</p>
                                                
                                                <div id="info_vesting_withdraw" style="display: none;"><p>Выводится по <span id="vesting_withdraw_rate"></span> SHARES 28 дней</p>
                                                <p>Следующий вывод: <span id="next_vesting_withdrawal"></span></p>
                                                <p>В конечном итоге вы выведите <span id="full_vesting_withdraw"></span></p>
                                                <p><input type="button" id="cancel_vesting_withdraw" value="Отменить вывод SHARES"></p></div>
                                                <div id="witnesses_vote_button"><strong>Проголосовать за создателя проекта dpos.space.</strong></div>
                                                                                                </div>
                                                
                                                <div id="wallet_transfer_history" style="display: none;">
                                                <h2>История переводов средств</h2>
                                                <p>Совет: нажмите на кнопку "Ещё" несколько раз (чем больше, тем лучше): будет больше шанс, что среди кучи операций попадётся нужная вам - сможете отобразить их.</p>
                                                <div id="filtrs"><p><span id="all_transfers" align="left">Все</span> <span id="get_transfers" align="center">Входящие</span> <span id="send_transfers" align="right">Исходящие</span></p>
                                                    <p><span id="award" align="left">Награждения</span> <span id="receive_award" align="right">Полученные награды</span></p>
                                                <p><span id="benefactor_award" align="left">Бенефициарские</span> <span id="witness_reward" align="right">Награды делегату</span></p>
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