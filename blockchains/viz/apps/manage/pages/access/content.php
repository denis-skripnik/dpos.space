<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<h2>Страницы сервиса</h2>
<table><tr><th>Доступы аккаунта</th>
<th><a href="'.$conf['siteUrl'].'viz/manage/profile">Профиль</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/witnesses">Делегаты</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/witness">Управление делегатом</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/workers">Заявки воркеров</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/create-account">Создать аккаунт/субаккаунт</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/reset-keys">Сброс ключей</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/many-invites">Множество инвайтов (чеков)</a></th>
<th><a href="'.$conf['siteUrl'].'viz/manage/multisig">Мультисиг</a></th>
</tr></table>
<style>.hidden{display:none;}</style>
<script src="'.$conf['siteUrl'].'blockchains/viz/apps/manage/pages/access/dostup.js"></script>
<div class="page page-manage-access" data-title="Доступы аккаунта">
				<div class="card">
					<h3>Доступы аккаунта</h3>
					<p>Внимание! Данный подраздел предназначен для продвинутых пользователей.</p>
					<p>
						<label class="input-descr">
							<span class="input-caption">Аккаунт:</span>
							<input type="text" name="manage-access-login" class="simple-rounded">
						</label>
					</p>
					<p class="red manage-access-preload-error"></p>
					<p class="green manage-access-preload-success"></p>
					<p>
						<input class="manage-access-preload-action blue-button captions" type="button" value="Просмотреть схему доступов" onclick="let account=$(`.page-manage-access input[name=manage-access-login]`).val().toLowerCase().trim();
	manage_access_preload(account,$(`.page-manage-access`));">
						<span class="submit-button-ring" rel="preload"></span>
						<span class="icon icon-margin hidden icon-color-blue icon-check" rel="preload"></span>
					</p>

					<div class="account-keys hidden">
						<hr>
						<h3 class="left">Схема доступов</h3>

						<p>Аккаунт: <span class="green account-login"></span></p>

						<p>Master или главный тип доступа:</p>
						<div class="account-keys-master captions">
							<p>
								<label class="input-descr">
									<span class="input-caption">Необходимый вес:</span>
									<input type="text" name="master-weight-threshold" class="simple-rounded">
								</label>
							</p>
							<hr>
							<p class="bold">Ключи для подписи:</p>
							<div class="master-keys">
								<div class="none-auths">Ключи отсутствуют</div>
							</div>
							<div class="add-key-auths">
								<input class="simple-inline" type="text" name="public-key" placeholder="публичный ключ">
								<input class="simple-inline" type="text" name="private-key" placeholder="приватный ключ">
								<input class="simple-inline" type="text" name="weight" placeholder="вес">
								<a class="gen-key-auths-action blue-button-inline unselectable" rel="master" onclick="genkeyauthsaction(`master`);">сгенерировать</a>
								<a class="add-key-auths-action blue-button-inline unselectable" rel="master" onclick="addkeyauthsaction(`master`);">добавить ключ</a>
							</div>
							<hr>
							<p class="bold">Доверенные аккаунты:</p>
							<div class="master-accounts">
								<div class="none-auths">Доверенных аккаунтов нет</div>
							</div>
							<div class="add-account-auths">
								<input class="simple-inline" type="text" name="account" placeholder="аккаунт">
								<input class="simple-inline" type="text" name="weight" placeholder="вес">
								<a class="add-account-auths-action blue-button-inline unselectable" rel="master" onclick="addaccountauthsaction(`master`);">добавить аккаунт</a>
							</div>
						</div>

						<p>Active или активный тип доступа:</p>
						<div class="account-keys-active captions">
							<p>
								<label class="input-descr">
									<span class="input-caption">Необходимый вес:</span>
									<input type="text" name="active-weight-threshold" class="simple-rounded">
								</label>
							</p>
							<hr>
							<p class="bold">Ключи для подписи:</p>
							<div class="active-keys">
								<div class="none-auths">Ключи отсутствуют</div>
							</div>
							<div class="add-key-auths">
								<input class="simple-inline" type="text" name="public-key" placeholder="публичный ключ">
								<input class="simple-inline" type="text" name="private-key" placeholder="приватный ключ">
								<input class="simple-inline" type="text" name="weight" placeholder="вес">
								<a class="gen-key-auths-action blue-button-inline unselectable" rel="active" onclick="genkeyauthsaction(`active`);">сгенерировать</a>
								<a class="add-key-auths-action blue-button-inline unselectable" rel="active" onclick="addkeyauthsaction(`active`);">добавить ключ</a>
							</div>
							<hr>
							<p class="bold">Доверенные аккаунты:</p>
							<div class="active-accounts">
								<div class="none-auths">Доверенных аккаунтов нет</div>
							</div>
							<div class="add-account-auths">
								<input class="simple-inline" type="text" name="account" placeholder="аккаунт">
								<input class="simple-inline" type="text" name="weight" placeholder="вес">
								<a class="add-account-auths-action blue-button-inline unselectable" rel="active" onclick="addaccountauthsaction(`active`);">добавить аккаунт</a>
							</div>
						</div>

						<p>Regular или обычный тип доступа:</p>
						<div class="account-keys-regular captions">
							<p>
								<label class="input-descr">
									<span class="input-caption">Необходимый вес:</span>
									<input type="text" name="regular-weight-threshold" class="simple-rounded">
								</label>
							</p>
							<hr>
							<p class="bold">Ключи для подписи:</p>
							<div class="regular-keys">
								<div class="none-auths">Ключи отсутствуют</div>
							</div>
							<div class="add-key-auths">
								<input class="simple-inline" type="text" name="public-key" placeholder="публичный ключ">
								<input class="simple-inline" type="text" name="private-key" placeholder="приватный ключ">
								<input class="simple-inline" type="text" name="weight" placeholder="вес">
								<a class="gen-key-auths-action blue-button-inline unselectable" rel="regular" onclick="genkeyauthsaction(`regular`);">сгенерировать</a>
								<a class="add-key-auths-action blue-button-inline unselectable" rel="regular" onclick="addkeyauthsaction(`regular`);">добавить ключ</a>
							</div>
							<hr>
							<p class="bold">Доверенные аккаунты:</p>
							<div class="regular-accounts">
								<div class="none-auths">Доверенных аккаунтов нет</div>
							</div>
							<div class="add-account-auths">
								<input class="simple-inline" type="text" name="account" placeholder="аккаунт">
								<input class="simple-inline" type="text" name="weight" placeholder="вес">
								<a class="add-account-auths-action blue-button-inline unselectable" rel="regular" onclick="addaccountauthsaction(`regular`);">добавить аккаунт</a>
							</div>
						</div>

						<p>
							<label class="input-descr">
								<span class="input-caption">Memo или ключ заметок (<a class="manage-access-gen-memo unselectable" onclick="let private_key=pass_gen(100,true);
	let public_key=viz.auth.wifToPublic(private_key);
	$(`.page-manage-access input[name=manage-access-memo-key]`).attr(`data-private-key`,private_key);
	$(`.page-manage-access input[name=manage-access-memo-key]`).val(public_key);">сгенерировать новый</a>):</span>
								<input type="text" name="manage-access-memo-key" class="simple-rounded" placeholder="VIZ..." disabled>
							</label>
						</p>

						<p>
							<label class="input-descr">
								<span class="input-caption">Главный ключ (master) для аккаунта <span class="account-login bold"></span>:</span>
								<input type="text" name="manage-access-master-key" class="simple-rounded" placeholder="5K..." data-account="">
								<input type="hidden" name="manage-access-json-metadata">
							</label>
						</p>

						<p class="red manage-access-save-error"></p>
						<p>
							<input class="manage-access-save-action blue-button captions" type="button" value="Сохранить схему доступа" onclick="let account=$(`.page-manage-access input[name=manage-access-master-key]`).attr(`data-account`);
	let master_key=$(`.page-manage-access input[name=manage-access-master-key]`).val().trim();
	manage_access_save(account,master_key,$(`.page-manage-access`));">
							<span class="submit-button-ring" rel="save"></span>
							<span class="icon icon-margin hidden icon-color-blue icon-check" rel="save"></span>
						</p>
						<p class="green manage-access-save-success"></p>
						<div class="manage-access-new-keys"></div>
					</div>

					<div class="addon captions"><h3>Подсказка</h3><p>Если вы хотите просто сбросить ключи доступа для аккаунта — перейдите в подраздел <a data-href="/accounts/reset-access/">«Сбросить ключи»</a>.</p></div>
				</div>
			</div>
<script>	$(`.page-manage-access input[name=manage-access-login]`).val(viz_login);</script>
'; ?>