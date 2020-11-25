<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div id="active_auth_msg" style="display: none;"><p>Для работы с кошельком необходим активный ключ. Укажите его <a href="'.$conf['siteUrl'].'golos/accounts" target="_blank">на странице аккаунтов</a>. Если вы авторизованы, удалите аккаунт и добавьте с активным ключом; Если нет, авторизуйтесь с указанием обоих ключей.</p></div>                        
<div id="active_page">
<div id="main_wallet_info" style="display: none;">
<h2>Балансы пользователя <span id="username"></span></h2>
<p>После клика по балансу откроется либо список действий, либо список аккаунтов (для полученного и переданного делегирования). По наведении появится подсказка.</p>
<table><thead><tr><th>Основной баланс</th><th>TIP-баланс</th></tr></thead>
<tbody id="balances"></tbody></table>
<ul id="actions" class="terms" style="display: none;">      </ul>

<div style="display: none;" id="vesting_withdraw_modal">
                                                      <h4 class="modal-title">Вывод СГ в golos</h4>
                                                      <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                <div id="action_vesting_withdraw">
                                                <p><strong>Предупреждение: если у вас сейчас уже есть вывод, отправка этой формы сбросит сумму на вывод.</strong></p>
                                                <form name="postForm" class="form-validate col-sm-10 col-sm-offset-1">
                                                <p><label for="vesting_withdraw_amount">Сумма на вывод (<span id="max_vesting_withdraw">Вывести все доступные <span id="max_vesting_withdraw_result"></span> СГ</span>):</label></p>
                                                <p><input type="text" name="vesting_withdraw_amount" id="action_vesting_withdraw_amount" placeholder="Введите сумму в формате 1.000000"></p>
                                                 <p><input type="button" id="action_vesting_withdraw_start" value="Начать вывод"></p>
                                                </form>
                                                </div>
                                                      </div>
                                                      <div style="display: none;" id="transfer_modal">
                                                      <h4 class="modal-title">Перевод <span class="transfer_modal_token"></span> на другой аккаунт</h4>
                                                      <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                      <div id="action_transfer">
                                                <form name="postForm" class="form-validate col-sm-10 col-sm-offset-1">
                                                <p><label for="transfer_template">Выберите шаблон перевода:</label></p>
<p><select name="transfer_template" id="select_transfer_template">
<option value="">Выберите шаблон (данные будут установлены в поля при выборе)</option>
</select> <span style="display: none;" id="remove_transfer_template">(<input type="button" value="Удалить текущий шаблон" id="action_remove_transfer_template">)</span> </p>
                                                <p><label for="transfer_to">Кому:</label></p>
                                                <p><input type="text" name="transfer_to" id="action_transfer_to" placeholder="Введите получателя"></p>
                                                 <p><label for="transfer_amount">Сумма перевода (<span id="max_token_transfer">Перевести все доступные <span id="max_transfer_amount"></span> <span class="transfer_modal_token"></span></span>):</label></p>
                                                <p><input type="text" name="transfer_amount" id="action_transfer_amount" placeholder="Введите сумму в формате 1.000"></p>
                                                <p><label for="transfer_memo">Заметка (описание) к платежу:</label></p>
                                                <p><input type="text" name="transfer_memo" id="action_transfer_memo" placeholder="Введите memo"></p>
                                                <p><label for="transfer_in">Куда переводить:</label></p>
                                                <p><select name="transfer_in" id="transfer_in">
<option value="to_balance">На ликвидный баланс</option>
<option value="to_tip">На баланс донатов</option>
<option value="to_vesting">в СГ</option>
                                                </select></p>
                                                 <p><input type="button" id="action_transfer_start" value="Перевести"></p>
                                                <hr>
                                                <p><input type="button" id="action_save_transfer_template" value="Создать шаблон перевода"></p>
                                                 </form>
                                                      </div>
                                                      </div>
                                                      <div style="display: none;" id="to_shares_transfer_modal">
                                                      <h4 class="modal-title">Перевод golos в СГ этого аккаунта</h4>
                                                      <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                      <div id="action_to_shares_transfer"><form name="postForm" class="form-validate col-sm-10 col-sm-offset-1">
                                                 <p><label for="to_shares_transfer_amount">Количество golos (<span id="max_to_shares_transfer">Все доступные <span class="golos_balance"></span> golos</span>):</label></p>
                                                <p><input type="text" name="to_shares_transfer_amount" id="action_to_shares_transfer_amount" placeholder="Введите сумму в формате 1.000"></p>
                                                 <p><input type="button" id="action_to_shares_transfer_start" value="Начать перевод"></p>
                                                </form></div>
                                                      </div>
                                                      <div style="display: none;" id="vesting_delegate_modal">
                                                      <h4 class="modal-title">Делегирование СГ</h4>
                                                      <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                <div id="action_vesting_delegate"><form name="postForm" class="form-validate col-sm-10 col-sm-offset-1">
                                                <p><label for="vesting_delegate_to">Кому:</label></p>
                                                <p><input type="text" name="vesting_delegate_to" id="action_vesting_delegate_to" placeholder="Введите получателя"></p>
                                                 <p><label for="vesting_delegate_amount">Сумма делегирования (<span id="max_vesting_delegate">Делегировать все доступные <span id="max_vesting_deligate"></span> СГ</span>):</label></p>
                                                <p><input type="text" name="vesting_delegate_amount" id="action_vesting_delegate_amount" placeholder="Введите сумму в формате 1.000000"></p>
                                                <p id="delegate_interest_rate_filde"><label for="interest_rate">Процент с кураторских:<br>
                                               <input type="text" name="interest_rate" value="80" data-fixed="interest_rate"> <input type="range" max="80" name="interest_rate" id="action_vesting_delegate_interest_rate" data-fixed="interest_rate" value="80"></label></p>
<input type="hidden" id="is_delegated" value="no">
                                               <p><input type="button" id="action_vesting_delegate_start" value="делегировать"></p>
                                                </form></div>
                                                      </div>
                                                      <div style="display: none;" id="accumulative_balance_modal">
                                                      <h4 class="modal-title">Получение начислений на СГ</h4>
                                                      <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                      <div id="action_golos_claim">
                                                <form name="postForm" class="form-validate col-sm-10 col-sm-offset-1">
                                                <p><label for="accumulative_balance_to">Кому:</label></p>
                                                <p><input type="text" name="accumulative_balance_to" id="accumulative_balance_to" placeholder="Введите получателя"></p>
                                                 <p><label for="accumulative_balance_amount">Сумма перевода (<span id="max_accumulative_balance"></span>):</label></p>
                                                <p><input type="text" name="accumulative_balance_amount" id="accumulative_balance_amount" placeholder="Введите сумму в формате 1.000"></p>
                                                <p><label for="accumulative_balance_vesting">Перевод в СГ: 
<input type="checkbox" name="accumulative_balance_vesting" id="accumulative_balance_vesting" placeholder="Перевод в СГ"></label></p>
                                                 <p><input type="button" id="accumulative_balance_start" value="Получить"></p>
                                                </form>
                                                      </div>
                                                      </div>
                                                      <div style="display: none;" id="donate_modal">
                                                      <h4 class="modal-title">Желаю отблагодарить токенами <span class="donate_modal_token"></span></h4>
                                                      <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                      <div id="action_donate">
                                                <form name="postForm" class="form-validate col-sm-10 col-sm-offset-1">
                                                <p><label for="donate_template">Выберите шаблон доната:</label></p>
<p><select name="donate_template" id="select_donate_template">
<option value="">Выберите шаблон (данные будут установлены в поля при выборе)</option>
</select> <span style="display: none;" id="remove_donate_template">(<input type="button" value="Удалить текущий шаблон" id="action_remove_donate_template">)</span> </p>
                                                <p><label for="donate_to">Кому:</label></p>
                                                <p><input type="text" name="donate_to" id="donate_to" placeholder="Введите получателя"></p>
                                                 <p><label for="donate_amount">Сумма перевода (<span id="max_token_donate">Перевести все доступные <span id="max_donate_amount"></span> <span class="donate_modal_token"></span></span>):</label></p>
                                                <p><input type="text" name="donate_amount" id="donate_amount" placeholder="Введите сумму в формате 1.000"></p>
                                                <p><label for="donate_memo">Комментарий:</label></p>
                                                <p><input type="text" name="donate_memo" id="donate_memo" placeholder="Введите комментарий"></p>
                                                 <p><input type="button" id="donate_start" value="Благодарю!"></p>
                                                 <hr>
                                                 <p><input type="button" id="action_save_donate_template" value="Создать шаблон доната"></p>
                                                 </form>
                                                      </div>
                                                      </div>
                                                      <div style="display: none;" id="transfer_from_tip_modal">
                                                      <h4 class="modal-title">Перевод <span class="transfer_from_tip_modal_token"></span> <span id="transfer_from_tip_to"></span> с баланса донатов</h4>
                                                      <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                      <div id="action_golos_transfer_from_tip">
                                                <form name="postForm" class="form-validate col-sm-10 col-sm-offset-1">
                                                <p><label for="transfer_from_tip_to">Кому:</label></p>
                                                <p><input type="text" name="transfer_from_tip_to" id="transfer_from_tip_to" placeholder="Введите получателя"></p>
                                                 <p><label for="transfer_from_tip_amount">Сумма перевода (<span id="max_token_transfer_from_tip">Перевести все доступные <span id="max_transfer_from_tip_amount"></span> <span class="transfer_from_tip_modal_token"></span></span>):</label></p>
                                                <p><input type="text" name="transfer_from_tip_amount" id="transfer_from_tip_amount" placeholder="Введите сумму в формате 1.000"></p>
                                                <p><label for="transfer_from_tip_memo">Заметка (описание):</label></p>
                                                <p><input type="text" name="transfer_from_tip_memo" id="transfer_from_tip_memo" placeholder="Введите memo"></p>
                                                 <p><input type="button" id="transfer_from_tip_start" value="Перевести"></p>
                                                </form>
                                                      </div>
                                                      </div>
                                                      <div style="display: none;" id="golos_diposit_modal">
                                                      <h4 class="modal-title">Пополнение счёта вашего аккаунта в GOLOS</h4>
                                                      <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                      <p><strong>Пополнение производится с использованием инвайт-кодов. Получить за фиат или криптовалюту их вы сможете, обратившись к пользователям golos, например, к создателю liveblogs.</strong></p>
                                                      <div id="action_vesting_diposit">
                                                      <form name="postForm" class="form-validate col-sm-10 col-sm-offset-1">
                                                      <p><label for="invite_secret">Инвайт-код (Начинается с 5):</label></p>
                                                      <p><input type="text" name="invite_secret" id="invite_secret" placeholder="5K..."></p>
                                                                                                      <p><input type="button" id="action_vesting_diposit_start" value="Пополнить"></p>
                                                                                                      </form>
                                                                                                            </div>
                                                                                                            </div>
                                                                                                            <div style="display: none;" id="create_invite_form_modal">
                                                                                                            <h4 class="modal-title">Создание инвайта</h4>
                                                                                                            <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                                                                            <p>Инвайты могут использоваться при регистрации и для перевода в баланс</p>
                                                                                                            <div id="create_invite"><form name="postForm" class="form-validate col-sm-10 col-sm-offset-1">
                                                                                                            <p><label for="create_invite_balance">Баланс инвайта (<span id="max_invite_balance">В баланс инвайта все доступные <span class="golos_balance"></span> GOLOS</span>):</label></p>
                                                                                                            <p><input type="text" name="create_invite_balance" id="create_invite_amount" placeholder="Введите сумму в формате 1.000"></p>
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
                                                <div style="display: none;" id="modal_received_vesting_shares">
                                                <h4 class="modal-title">Список аккаунтов, которые делегировали Силу Голоса вам</h4>
                                                <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                <table><thead><tr><th>Логин</th><th>Сумма</th><th>Процент возврата кураторских</th><th>Мин. время возврата делегирования</th></tr></thead><tbody  id="body_received_vesting_shares"></tbody></table>
                                                      </div>
                                                <div style="display: none;" id="modal_delegated_vesting_shares">
                                                <h4 class="modal-title">Список аккаунтов, которым вы делегировали Силу Голоса</h4>
                                                <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                <table><thead><tr><th>Логин</th><th>Сумма</th><th>Процент возврата кураторских</th><th>Мин. время возврата делегирования</th><th>Действия</th></tr></thead><tbody id="body_delegated_vesting_shares"></tbody></table>
                                                      </div>
                                                      <div style="display: none;" id="uia_deposit_modal">
                                                      <h4 class="modal-title">Как пополнить баланс токеном <span class="diposit_modal_token"></span></h4>
                                                      <p><button data-fancybox-close class="btn">Закрыть</button></p>
<div id="uia_diposit_data"></div>
</div>
         
<div style="display: none;" id="uia_withdraw_modal">
<h4 class="modal-title">Вывод <span class="uia_withdraw_modal_token"></span></h4>
<p><button data-fancybox-close class="btn">Закрыть</button></p>
<form name="postForm" class="form-validate col-sm-10 col-sm-offset-1">
<input type="hidden" name="uia_withdraw_to" id="action_uia_withdraw_to">
<p><label for="transfer_amount">Сумма перевода (<span id="max_token_uia_withdraw">Перевести все доступные <span id="max_uia_withdraw_amount"></span> <span class="uia_withdraw_modal_token"></span></span>):</label></p>
<p><input type="text" name="uia_withdraw_amount" id="action_uia_withdraw_amount" placeholder="Введите сумму"></p>
<div  id="fields_uia_withdraw"></div>
<p><input type="button" id="action_uia_withdraw_start" value="Вывести"></p>
</form>
</div>

                                                      <p>Ваша доля (С учётом полученного и переданного), которая влияет на силу апвотов и флагов: <span id="full_vesting"></span> СГ</p>
                                                
                                                <div id="info_vesting_withdraw" style="display: none;"><p>Выводится по <span id="vesting_withdraw_rate"></span> СГ 8 недель</p>
                                                <p>Следующий вывод: <span id="next_vesting_withdrawal"></span></p>
                                                <p>В конечном итоге вы выведите <span id="full_vesting_withdraw"></span></p>
                                                <p><input type="button" id="cancel_vesting_withdraw" value="Отменить вывод СГ"></p></div>
                                                <div id="witnesses_vote_button"><strong>Проголосовать за создателя проекта dpos.space.</strong></div>
                                                                                                </div>
                                                
                                                <div id="wallet_transfer_history" style="display: none;">
                                                <h2>История переводов средств</h2>
                                                <div id="filtrs"><form>
                                                <p><label for="direction">Направление: </label>
                                          <select name="direction" id="direction" placeholder="Выберите направление">
                                          <option value="">Все</option>
                                          <option value="sender">Исходящие</option>
                                          <option value="receiver">Входящие</option>
                                          </select></p>
                                          <div style="width:100%; height:200px; overflow:auto; border:solid 1px #C3E4FE;">
                                          <ul><li><label><input type="checkbox" name="ops" value="transfer" placeholder="Переводы">Переводы</label></li>
                                          <li><label><input type="checkbox" name="ops" value="claim" placeholder="CLAIM">CLAIM</label></li>
<li><label><input type="checkbox" name="ops" value="transfer_to_tip" placeholder="Перевод ликвида в TIP-баланс">Перевод ликвида в TIP-баланс</label></li>
                                          <li><label><input type="checkbox" name="ops" value="transfer_to_vesting" placeholder="Переводы ликвида в СГ">Переводы ликвида в СГ</label></li>
                                          <li><label><input type="checkbox" name="ops" value="transfer_from_tip" placeholder="Переводы из TIP-баланса">Переводы из TIP-баланса (в СГ, если GOLOS, или на основной баланс)</label></li>
                                          <li><label><input type="checkbox" name="ops" value="delegate_vesting_shares" placeholder="Делегирования">Делегирования СГ</label></li>
                                          <li><label><input type="checkbox" name="ops" value="delegate_vesting_shares_with_interest" placeholder="Делегирования с процентом возврата">Делегирования СГ с процентом возврата</label></li>
                                          <li><label><input type="checkbox" name="ops" value="delegation_reward" placeholder="Награды делегатору"> награды делегатору</label></li>
                                          <li><label><input type="checkbox" name="ops" value="donate" placeholder="Донаты">Донаты</label></li>
                                          <li><label><input type="checkbox" name="ops" value="author_reward" placeholder="Авторские награды">Авторские награды</label></li>
                                          <li><label><input type="checkbox" name="ops" value="curation_reward" placeholder="Кураторские награды">Кураторские награды</label></li>
                                          <li><label><input type="checkbox" name="ops" value="comment_benefactor_reward" placeholder="Бенефициарские награды">Бенефициарские награды</label></li>
                                    <li><label><input type="checkbox" name="ops" value="producer_reward" placeholder="Награды делегату">Награды делегату</label></li>
                                    <li><label><input type="checkbox" name="ops" value="fill_order" placeholder="ордера на бирже (выполненные обмены)">ордера на бирже (выполненные обмены)</label></li>
                                    </ul>
                                          </div>
                                          <p><input type="button" value="Фильтр" onclick="createFiltr();"></p>
                                          </form>
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
'; ?>