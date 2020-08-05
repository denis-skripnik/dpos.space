<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
return '
<h2>Страницы сервиса</h2>
<p><span align="left"><a href="'.$conf['siteUrl'].'viz/awards">Форма награждения</a></span> <span align="right"><a href="'.$conf['siteUrl'].'viz/awards/url">Генератор url наград и qr-кодов</a></span></p>
<h2>Конструирование формы наград для размещения на любом сайте</h2>
<p>С помощью данного сервиса вы можете создать форму отправки награды для размещения на сайте.</p>
<p>Отмеченные флажки (чекбоксы) = отображение поля в форме награды, что будет у вас в приложении (На сайте, в расширении и т. д.)</p>
<p>"Кого наградить" - это настройка, позволяющая передать награду. После клика по кнопке "Получить код" вы увидете в первом многострочном поле (textarea) пример передачи значения "кому" в переменную target_user, которую определяет скрипт формы. Это необходимо, чтобы вы могли передать из своего приложения, например, из базы данных, логин получателя награды в VIZ.</p>
<h2>Настройка будущей формы</h2>
		<table id="work_area">
			<tr>
				<td>
					<ul id="sortable">
						<li>
							<label><input class="form_update" type="checkbox" name="target" /> <strong>Кого наградить</strong></label> <br>
							<br><i>Значение поля по-умолчанию:</i><br>
							<input class="form_update" data-title="Кого наградить" type="text" id="target_value" value="">
						</li>
						<li>
							<strong>Способ награды:</strong><br>
							<p>Процент энергии и сумма взаимозаменяемы. Сумма не является точной, и при указании большого значения может не хватить энергии или потратиться неожиданно много. Выберите используемый вариант:</p>
							<label><input type="radio" name="pay_method" class="pay_method form_update" value="amount" checked> Сумма награды</label><br>
							<label><input type="radio" name="pay_method" class="pay_method form_update" value="procent"> Процент энергии</label><br>

							<div id="procent_details">
								<br><i>Внешний вид поля:</i><br>
								<label><input type="radio" name="energy_view" class="energy_view form_update" value="field" checked> Поле для ввода</label><br>
								<label><input type="radio" name="energy_view" class="energy_view form_update" value="slider"> Ползунок</label><br>
								<br><label><input class="form_update" type="checkbox" name="energy_notification" /> Выводить ли предупреждение при выборе > 20%?</label>
								<br><i>Текст предупреждения по-умолчанию:</i><br>
								<textarea id="energy_notification_text">Вы выбрали > 20% энергии. Вам будет доступно мало наград</textarea><br>
								<br><i>Значение поля по-умолчанию:</i><br>
								<input class="form_update" data-title="Процент энергии" type="text" id="energy_value" value="">
							</div>
							<div id="amount_details">
								<br><i>Значение поля по-умолчанию:</i><br>
								<input class="form_update" data-title="Сумма награды" type="text" id="f_sum_value" value="">
							</div>
						</li>
						<li>
							<label><input class="form_update" type="checkbox" name="custom_sequence" /> <strong>Номер Custom операции (целое число)</strong></label><br>
							<br><i>Значение поля по-умолчанию:</i><br>
							<input class="form_update" data-title="Номер Custom операции" type="number" min="0" id="custom_sequence_value" value="">
						</li>
						<li>
							<label><input class="form_update" type="checkbox" name="f_memo" /> <strong>Заметка (memo)</strong></label><br>
							<label><input type="radio" name="note_mode" class="note_mode form_update" value="one" checked> Однострочное поле</label><br>
							<label><input type="radio" name="note_mode" class="note_mode form_update" value="many"> Многострочное поле</label><br>
							<br><i>Значение поля по-умолчанию:</i><br>
							<div id="note_field">
								<input class="form_update" data-title="Заметка (memo)" type="text" id="f_memo_value" value="">
							</div>
						</li>
						<li>
							<label><input class="form_update" type="checkbox" name="f_b" /> <strong>Бенефициарские отчисления приложению</strong></label>
							<br><i>Логин приложения:</i><br>
							<input class="form_update" data-title="Логин приложения бенефициара" type="text" id="f_b_login" value="6"><br>
							<i>Процент:</i><br>
							<input class="form_update" data-title="Процент приложения бенефициара" type="text" id="f_b_procent" value="6"><br><br>

							<label><input class="form_update" type="checkbox" name="f_b_user" /> <strong>Возврат прибыли пользователю</strong></label>
							<br><i>Логин пользователя:</i><br>
							<input class="form_update" data-title="Процент" type="text" id="f_b_username" value="user_login" disabled><br>

							<label><input type="radio" name="user_procent" class="user_procent form_update" value="fix" checked> Фиксированный процент</label><br>
							<label><input type="radio" name="user_procent" class="user_procent form_update" value="manual"> Процент может выбрать пользователь</label><br>

							<div id="user_procent_default">
								<br><i>Значение процента:</i><br>
								<input class="form_update" data-title="Процент" type="text" id="f_b_procent_value" value="7">
							</div>
							<div id="user_procent_manual">
								<br><i>Внешний вид поля:</i><br>
								<label><input type="radio" name="user_procent_view" class="user_procent_view form_update" value="field" checked> Поле для ввода</label><br>
								<label><input type="radio" name="user_procent_view" class="user_procent_view form_update" value="slider"> Ползунок</label><br>
								<br><i>Максимальное значение процента:</i><br>
								<input class="form_update" data-title="Процент" type="text" id="f_b_procent_maxvalue" value="7">
							</div>
						</li>
					</ul>
					<div class="non_sortable_field">
						<strong>Получать данные по URL</strong><br>
						<label><input type="radio" name="url_mode" class="url_mode form_update" value="ajax" checked> Получать результат из скрипта формы</label><br>
						<label><input type="radio" name="url_mode" class="url_mode form_update" value="redirect"> Редирект</label><br>

						<div id="url_redirect">
							<br><i>URL для перенаправления:</i><br>
							<input class="form_update" data-title="URL перенаправления после награды" type="text" id="f_url_value" value="http://yandex.ru">
						</div>
					</div>
				</td>
				<td>
					<h3>Форма результат:</h3>
<p>Если у вас уже подключены viz.min.js и/или sjcl.min.js, рекомендуем перед использованием формы удалить из её кода подключение. Если же не подключен, необходимо оставить их, поскольку иначе работать не будет.</p>
<p>Также необходимо <a href="'.$conf['siteUrl'].'blockchains/viz/apps/awards/pages/builder/builder.js" target="_blank">Скачать</a> builder.js (скрипт формы).</p>
					<div id="result"><form action="test.php"></form></div>
					<button onclick="get_code()">Получить код</button>
					<textarea id="head_code"></textarea>
					<textarea id="final_code"></textarea>
					<div id="pre_code">
						<div id="awards_send_form">
							<form action="index.html">
							</form>
						</div>
					</div>
				</td>
			</tr>
		</table>
<script src="'.$conf['siteUrl'].'blockchains/viz/apps/awards/pages/builder/footer.js"></script>
'; ?>