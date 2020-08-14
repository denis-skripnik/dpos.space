<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<h2>Адрес публичной Ноды</h2>
<p>Ниже вы можете указать произвольный адрес публичной Ноды. После сохранения обновите страницу.</p>
<form>
<p><label for="node_url">Адрес Ноды: </label>
<input type="text" name="node_url" id="public_node" value="">
<button type="button" id="submit_node">Сохранить</button>
</form>
<hr>
<h2>Публикация поста <br><strong>Бенефициарские 1%</strong></h2>

<div class="fillfields">
<div class="spoy_load">
<label class="custom-file-upload"><input id="files" type="file">Загрузить файл *.md</label> <input type="checkbox" id="spoiler_links"><label for="spoiler_links">?</label>
<div class="spoiler_body">
<p>Вы можете загрузить файл, чтобы заголовок, текст и теги из него оказались в соответствующих полях</p>
<h3>Формат</h3>
<ol><li>Первая строка - заголовок;</li>
<li>Вторая - теги через пробел</li>
<li>Третья и последующие - текст поста.</li></ol>
</div>
</div>

<div class="postedit">
<div class="spoy_load">
<input type="checkbox" id="spoiler_links3"><label for="spoiler_links3">Редактировать пост (введите ссылку)</label>
 <div class="spoiler_body">
<input type="text" id="postediturl" name="postedit" placeholder="https://golos.id/tag/@user/permlink">
    <button id="load4edit">Загрузить в редактор</button>
</div>
</div>
</div>
</div>

<form data-persist="garlic" data-domain="true" id="post-WLS-form" enctype="multipart/form-data">

<div class="ptitle">
<!--[if lt IE 10]><p><label for="post_title">Заголовок поста: </label></p><![endif]-->
<p><input type="text" name="post_title" id="content_title" value="" placeholder="заголовок поста" ></p>
</div>

<div class="previewimg">
<!--[if lt IE 10]><p><label for="post_image"Изображение превью (по умолчанию — первое фото из поста):</label></p><![endif]-->
<p><input type="text" name="post_image" id="content_image" value="" placeholder="Ссылка превью (по умолчанию — первое фото из поста)" ></p>
</div>

<div class="ptext">
<p><label for="post_text">Текст поста:<br>
<span><strong>ВНИМАНИЕ: при публикации со смартфона надо отключить автозамены и прочие функции клавиатуры, включая ввод заглавной буквы и точки. Иначе могут быть проблемы с дублированием текста и прочим. Проблема решается</strong></span></label></p>
<textarea name="post_text" id="content_text"  data-storage="false"></textarea>
</div>

<div class="drdrop"><input type="button" id="addimg" data-storage="false" value="Загрузить фото в пост" onclick="document.querySelector(&#39;#loadinp&#39;).click()" ></div><input id="loadinp" style="visibility: collapse; width: 0px;" type="file" onchange="upload(this.files[0])"><p></p>

<div class="category">
<!--[if lt IE 10]><p><label for="post_category">Выберите категорию: </label></p><![endif]-->
<p><select name="post_category" id="content_category" placeholder="Выберите категорию" required>
<option value="" disabled="">Выберите категорию</option><option value="ru--avto">авто</option><option value="ru--biznes">бизнес</option><option value="ru--blokcheijn">блокчейн</option><option value="ru--golos">голос</option><option value="ru--dom">дом</option><option value="ru--eda">еда</option><option value="ru--zhiznx">жизнь</option><option value="ru--zdorovxe">здоровье</option><option value="ru--igry">игры</option><option value="ru--iskusstvo">искусство</option><option value="ru--istoriya">история</option><option value="ru--kino">кино</option><option value="ru--kompxyutery">компьютеры</option><option value="ru--konkursy">конкурсы</option><option value="ru--kriptovalyuty">криптовалюты</option><option value="ru--kulxtura">культура</option><option value="ru--literatura">литература</option><option value="ru--mediczina">медицина</option><option value="ru--muzyka">музыка</option><option value="ru--nauka">наука</option><option value="ru--nepoznannoe">непознанное</option><option value="ru--obrazovanie">образование</option><option value="ru--politika">политика</option><option value="ru--pravo">право</option><option value="ru--priroda">природа</option><option value="ru--psikhologiya">психология</option><option value="ru--puteshestviya">путешествия</option><option value="ru--rabota">работа</option><option value="ru--religiya">религия</option><option value="ru--semxya">семья</option><option value="ru--sport">спорт</option><option value="ru--tvorchestvo">творчество</option><option value="ru--tekhnologii">технологии</option><option value="ru--treijding">трейдинг</option><option value="ru--fotografiya">фотография</option><option value="ru--khobbi">хобби</option><option value="ru--yekonomika">экономика</option><option value="ru--yumor">юмор</option><option value="ru--prochee">прочее</option><option value="en">en</option><option value="nsfw">nsfw</option>
</select></p>
</div>

<div class="ptags">
<!--[if lt IE 10]><p><label for="post_tags">Теги через пробел: </label></p><![endif]-->
<p><input type="text" name="post_tags" id="content_tags" value="" placeholder="Теги через пробел" ></p>
</div>

<div class="pperm">
</div>

<div class="additional">
    <p>Процент кураторам (Можно изменять только при создании поста): <input type="text" name="curation_rewards_percent" value="50" data-fixed="curation_rewards_percent"> <input type="range" name="curation_rewards_percent" id="curation_rewards_percent" data-fixed="curation_rewards_percent" value="50"></p>
    <div class="spoy_load">
<input type="checkbox" id="spoiler_links_time" ><label for="spoiler_links_time">Отложенный постинг. (кликните для показа/скрытия)</label>
 <div class="spoiler_body">
<!--[if lt IE 10]><p><label for="post_date_publish">Дата и время публикации поста: </label></p><![endif]-->
<p><input type="datetime-local" name="post_date_publish" id="content_datetime" data-storage="false" placeholder="Дата публикации"></p>

</div></div>
    <p><label for="payouts">Режим выплаты: </label></p>
<p><select name="payouts" id="content_payouts" >
<option selected="selected" value="10000">50% в GBG и GOLOS, 50% в СГ</option>
<option value="0">100% в СГ</option>
</select></p>
<hr>
    <div class="spoy_load">
<input type="checkbox" id="spoiler_links2" ><label for="spoiler_links2">Бенефициарские. (кликните для показа/скрытия)</label>
 <div class="spoiler_body">
<p>Вы можете указать других бенефициаров (помимо меня).</p>
<p><label for="benef_login">Логин бенефициара: </label></p>
<p><input name="benef_login" id="nick" placeholder="Введите бенефициара" type="text" ></p>
<p>Процент: <input type="text" name="benef_procent" value="" data-fixed="benef_procent"> <input type="range" name="benef_procent" id="per" data-fixed="benef_procent" max="99" value=""></p>
    <p><button type="button" onclick="add()">Добавить</button></p>
    <div>
    	<table id="out" border="1px">
    		<tr>
    			<th>Account</th>
    			<th>weight</th>
    			<th>Удаление</th>
    		</tr>
    	</table>
    	<p id="json"></p>
    </div>
</div></div>
<div class="spoy_load">
<input type="checkbox" id="spoiler_linksPermlink" ><label for="spoiler_linksPermlink">Пермлинк. (кликните для показа/скрытия)</label>
 <div class="spoiler_body">
<p><label for="user_permlink">Окончание адреса будущего поста (То, что после @логин). Только Английские символы и дефис "-" (Заполнять не обязательно): </label></p>
<p><input type="text" name="user_permlink" id="permlink_filde" data-storage="false" value=""></p>
</div></div>
</div>

<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'golos/accounts" target="_blank">здесь</a></p></div>
<div>
<p><strong><button type="button" onclick="post_submit();"  class="psend">Опубликовать!</button></strong></p>

<p><strong><button type="button" onclick="reset_button();"  class="pclear">Очистка форм поста</button></strong></p>
</div>

</form>
<script src="'.$conf['siteUrl'].'blockchains/golos/apps/post/js/_interface.js"></script>
'; ?>'