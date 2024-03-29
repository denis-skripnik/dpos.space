<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<h2>Страницы сервиса</h2>
<table><tr><th>Сброс ключей</th>
<th><a href="'.$conf['siteUrl'].'viz/manage/access">Доступы аккаунта</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/profile">Профиль</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/witnesses">Делегаты</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/witness">Управление делегатом</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/workers">Заявки воркеров</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/create-account">Создать аккаунт/субаккаунт</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/many-invites">Множество инвайтов (чеков)</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/multisig">Мультисиг</a></th>
</tr></table>
<style>.hidden{display:none;}</style>
<script src="'.$conf['siteUrl'].'blockchains/viz/apps/manage/pages/reset-keys/sbros.js"></script>
<div class="page page-reset-access" data-title="Сбросить ключи">
					<div class="card">
						<h3>Сбросить ключи</h3>
						<p>Внимание! При сбросе ключей у аккаунта удаляются все старые доверенные аккаунты и дополнительные ключи. Останется только по одному ключу для каждого из типов доступа.</p>
						<p>
							<label class="input-descr">
								<span class="input-caption">Аккаунт для сброса ключей:</span>
								<input type="text" name="reset-access-login" class="simple-rounded">
							</label>
						</p>
						<p>
							<label class="input-descr">
								<span class="input-caption">Главный ключ (master):</span>
								<input type="text" name="reset-access-master-key" class="simple-rounded" placeholder="5K...">
							</label>
						</p>

						<p class="red reset-access-error"></p>
						<p class="green reset-access-success"></p>
						<p>
							<input class="reset-access-action blue-button captions" type="button" value="Сбросить ключи" onclick="let account=$(`.page-reset-access input[name=reset-access-login]`).val().toLowerCase().trim();
		let master_key=$(`.page-reset-access input[name=reset-access-master-key]`).val().trim();
		reset_access(account,master_key,$(`.page-reset-access`));">
							<span class="submit-button-ring"></span>
							<span class="icon icon-margin hidden icon-color-blue icon-check"></span>
						</p>

						<div class="account-keys hidden">
							<h3 class="left">Ключи заменены!</h3>

							<p>Аккаунт: <span class="green account-login"></span></p>

							<p>Ключи:</p>

							<p><span class="master-key captions">&hellip;</span> &mdash; master или главный ключ</p>
							<p><span class="active-key captions">&hellip;</span> &mdash; active или активный ключ</p>
							<p><span class="regular-key captions">&hellip;</span> &mdash; regular или обычный ключ</p>
							<p><span class="memo-key captions">&hellip;</span> &mdash; memo или ключ заметок</p>

							<p>Сохраните ключи прямо сейчас!</p>
						</div>

						<div class="addon captions"><h3>Подсказка</h3><p>Если вы хотите настроить управление аккаунтом для мульти-подписи, перейдите в подраздел <a data-href="dostup.html">«Доступы аккаунта»</a>.</p></div>
					</div>
				</div>
<script>	$(`input[name=reset-access-login]`).val(viz_login);</script>
'; ?>