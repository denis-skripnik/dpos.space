<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div id="posting_auth_msg" style="display: none;"><p>Для импорта необходим постинг ключ. Укажите его <a href="'.$conf['siteUrl'].'golos/accounts" target="_blank">на странице аккаунтов</a>.</p></div>
<div id="posting_page">
<form>
<p><label for="url-input">Url статьи в telegra.ph или mirror.xyz:</label>
<input type="text" id="url-input" name="url"></p>
<p><select name="post_category" id="content_category" placeholder="Выберите категорию" required>
<option value="" disabled="">Выберите категорию</option><option value="ru--avto">авто</option><option value="ru--biznes">бизнес</option><option value="ru--blokcheijn">блокчейн</option><option value="ru--golos">голос</option><option value="ru--dom">дом</option><option value="ru--eda">еда</option><option value="ru--zhiznx">жизнь</option><option value="ru--zdorovxe">здоровье</option><option value="ru--igry">игры</option><option value="ru--iskusstvo">искусство</option><option value="ru--istoriya">история</option><option value="ru--kino">кино</option><option value="ru--kompxyutery">компьютеры</option><option value="ru--konkursy">конкурсы</option><option value="ru--kriptovalyuty">криптовалюты</option><option value="ru--kulxtura">культура</option><option value="ru--literatura">литература</option><option value="ru--mediczina">медицина</option><option value="ru--muzyka">музыка</option><option value="ru--nauka">наука</option><option value="ru--nepoznannoe">непознанное</option><option value="ru--obrazovanie">образование</option><option value="ru--politika">политика</option><option value="ru--pravo">право</option><option value="ru--priroda">природа</option><option value="ru--psikhologiya">психология</option><option value="ru--puteshestviya">путешествия</option><option value="ru--rabota">работа</option><option value="ru--religiya">религия</option><option value="ru--semxya">семья</option><option value="ru--sport">спорт</option><option value="ru--tvorchestvo">творчество</option><option value="ru--tekhnologii">технологии</option><option value="ru--treijding">трейдинг</option><option value="ru--fotografiya">фотография</option><option value="ru--khobbi">хобби</option><option value="ru--yekonomika">экономика</option><option value="ru--yumor">юмор</option><option value="ru--prochee">прочее</option><option value="en">en</option><option value="nsfw">nsfw</option>
</select></p>
<div class="ptags">
<!--[if lt IE 10]><p><label for="post_tags">Теги через пробел: </label></p><![endif]-->
<p><input type="text" name="post_tags" id="content_tags" value="" placeholder="Теги через пробел" ></p>
</div>
<p><button type="button" id="import-button">Импортировать</button></p>
</form>
<div color="red" id="results"></div>
</div>'; ?>