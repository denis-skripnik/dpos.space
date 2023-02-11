<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div id="auth_msg" style="display: none;"><p>Для работы с кошельком необходимо авторизоваться seed фразой. Укажите её <a href="'.$conf['siteUrl'].'minter/accounts" target="_blank">на странице аккаунтов</a>.</p></div>                        
<div id="seed_page">
<div id="main_wallet_info" style="display: none;">
<p>Адрес: <a target="_blank" id="address_link"><span id="current_address"></span></a><br>
<input type="button" id="copy_address" value="Копировать"></p>
<h2>Балансы пользователя <span id="username"></span></h2>
<ul id="balances"></ul>
<ul id="actions" class="terms" style="display: none;">      </ul>
<h2>Делегированные монеты</h2>
<p><a href="'.$conf['siteUrl'].'minter/wallet/delegation" target="_blank">Перейти</a></p>
<div style="display: none;" id="vesting_withdraw_modal">
                                                      <h4 class="modal-title">Вывод СГ в golos</h4>
                                                      <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                <div id="action_vesting_withdraw">
                                                <p><strong>Предупреждение: если у вас сейчас уже есть вывод, отправка этой формы сбросит сумму на вывод.</strong></p>
                                                <form class="form" name="postForm">
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
                                                <form class="form" name="postForm">
                                                <p><label for="transfer_template">Выберите шаблон перевода:</label></p>
<p><select name="transfer_template" id="select_transfer_template">
<option value="">Выберите шаблон (данные будут установлены в поля при выборе)</option>
</select> <span style="display: none;" id="remove_transfer_template">(<input type="button" value="Удалить текущий шаблон" id="action_remove_transfer_template">)</span> </p>
                                                <p><label for="transfer_to">Кому:</label></p>
                                                <p><input type="text" name="transfer_to" id="action_transfer_to" placeholder="Mx..."></p>
                                                 <p><label for="transfer_amount">Сумма перевода (<span id="max_token_transfer">Перевести все доступные <span id="max_transfer_amount"></span> <span class="transfer_modal_token"></span></span>):</label></p>
                                                <p><input type="text" name="transfer_amount" id="action_transfer_amount" placeholder="Введите сумму в формате 1.000"></p>
                                                <p><label for="transfer_memo">Заметка (описание) к платежу:</label></p>
                                                <p><input type="text" name="transfer_memo" id="action_transfer_memo" placeholder="Введите memo"></p>
<p><strong>Комиссия: <span id="transfer_fee"></span></strong></p>
                                                <p><input type="button" id="action_transfer_start" value="Перевести"></p>
                                                <hr>
                                                <p><input type="button" id="action_save_transfer_template" value="Создать шаблон перевода"></p>
                                                 </form>
                                                      </div>
                                                      </div>
                                                      <div style="display: none;" id="withdraw_modal">
                                                      <h4 class="modal-title">Вывод <span class="withdraw_modal_token"></span> в <span id="withdraw_modal_blockchain"></span></h4>
                                                      <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                      <div id="action_withdraw">
                                                <form class="form" name="postForm">
                                                <p><label for="withdraw_template">Выберите шаблон вывода:</label></p>
<p><select name="withdraw_template" id="select_withdraw_template">
<option value="">Выберите шаблон (данные будут установлены в поля при выборе)</option>
</select> <span style="display: none;" id="remove_transfer_template">(<input type="button" value="Удалить текущий шаблон" id="action_remove_transfer_template">)</span> </p>
                                                <p><label for="withdraw_to">Куда:</label></p>
                                                <p><input type="text" name="withdraw_to" id="action_withdraw_to" placeholder="0x..."></p>
                                                 <p><label for="withdraw_amount">Сумма вывода (<span id="max_token_withdraw">Перевести все доступные <span id="max_withdraw_amount"></span> <span class="withdraw_modal_token"></span></span>):</label></p>
                                                <p><input type="text" name="withdraw_amount" id="action_withdraw_amount" placeholder="Введите сумму в формате 1.234"></p>
<p><strong>Комиссия в Minter: <span id="withdraw_fee"></span></strong></p>
<p><strong>Комиссия Hub: <span id="withdraw_hub_fee"></span> <span class="withdraw_modal_token"></span></strong></p>

<p><strong>Итоговая сумма, которая вам придёт: <span id="finish_withdraw_amount"></span> <span class="withdraw_modal_token"></span></strong></p><p><input type="button" id="action_withdraw_start" value="Вывести"></p>
                                                <hr>
                                                <p><input type="button" id="action_save_withdraw_template" value="Создать шаблон вывода"></p>
                                                 </form>
                                                      </div>
                                                      </div>
                                                      <div style="display: none;" id="convert_modal">
                                                      <h4 class="modal-title">Конвертация <span class="convert_modal_token"></span></h4>
                                                      <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                      <div id="action_convert">
                                                <form class="form" name="postForm">
                                                <p><label for="convert_to">Монета получения:</label></p>
                                                <p><input type="text" name="convert_to" id="action_convert_to" placeholder="BIP"></p>
                                                <p><label for="convert_amount">Сумма конвертации (<span id="max_token_convert">Обменять все доступные <span id="max_convert_amount"></span> <span class="convert_modal_token"></span></span>):</label></p>
                                                <p><input type="text" name="convert_amount" id="action_convert_amount" placeholder="Введите сумму в формате 1.000"></p>
<p><strong>Комиссия: <span id="convert_fee"></span>
Сумма покупки: <span id="buy_amount"></span></strong></p>
<p id="swap_route_block"  style="display: none;">Путь (route) обмена: <span id="swap_route"></span></p>
<p><input type="button" id="action_convert_start" value="Обменять"></p>
                                                 </form>
                                                      </div>
                                                      </div>
                                                      <div style="display: none;" id="delegate_modal">
                                                      <h4 class="modal-title">Делегирование <span class="delegate_modal_token"></span></h4>
                                                      <p><button data-fancybox-close class="btn">Закрыть</button></p>
                                                      <div id="action_delegate">
                                                <form class="form" name="postForm">
                                                <p><label for="delegate_template">Выберите шаблон делегирования:</label></p>
                                                <p><select name="delegate_template" id="select_delegate_template">
                                                <option value="">Выберите шаблон (данные будут установлены в поля при выборе)</option>
                                                </select> <span style="display: none;" id="remove_delegate_template">(<input type="button" value="Удалить текущий шаблон" id="action_remove_delegate_template">)</span> </p>
                                                <p><label for="delegate_to">Публичный ключ валидатора (можно выбрать <a href="'.$conf['siteUrl'].'minter/validators" target="_blank">тут</a>):</label></p>
                                                <p><input type="text" name="delegate_to" id="action_delegate_key" placeholder="MP..."></p>
                                                 <p><label for="delegate_amount">Сумма делегирования (<span id="max_token_delegate">делегировать все доступные <span id="max_delegate_amount"></span> <span class="delegate_modal_token"></span></span>):</label></p>
                                                <p><input type="text" name="delegate_amount" id="action_delegate_stake" placeholder="Введите сумму в формате 1.000"></p>
<p><strong>Комиссия: <span id="delegate_fee"></span></strong></p>
                                                <p><input type="button" id="action_delegate_start" value="Делегировать"></p>
                                                <hr>
                                                <p><input type="button" id="action_save_delegate_template" value="Создать шаблон делегирования"></p> 
                                                </form>
                                                      </div>
                                                      </div>
                                                      
                                                                                                </div>
                                                
                                                <div id="wallet_transfer_history" style="display: none;">
                                                <h2>История транзакций</h2>
<table><thead><tr><th>Дата</th>
<th>Блок</th>
<th>Хеш транзакции</th>
<th>Тип</th>
<th>Сумма</th>
<th>Сообщение</th></tr>
</thead>
<tbody id="history_tbody"></tbody></table>
<div id="history_pages"></div>
                                                </div>
                                                                                </div>
'; ?>