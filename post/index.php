<?php
require $_SERVER['DOCUMENT_ROOT'].'/urls.php';
require $_SERVER['DOCUMENT_ROOT'].'/params.php';
if(!isset($array_url[1] ) ) {
  require_once $_SERVER['DOCUMENT_ROOT'].'/template/header.php';
require_once $_SERVER['DOCUMENT_ROOT'].'/template/menu.php';
 echo '<main class="content">
<h2>Выберите вверху блокчейн и приступайте к постингу</h2>
</main>';
require_once $_SERVER['DOCUMENT_ROOT'].'/template/footer.php';
} else if( isset($array_url[1] ) ) {
?>
<h1>Публикация поста <p><strong>Бенефициарские 1%<span id="golos-curation_percent"></span></strong></p></h1>

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
<input type="text" id="postediturl" name="postedit" placeholder="<?= $client ?>/tag/@user/permlink">
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
<p><textarea name="post_text" id="content_text" data-storage="false"></textarea>
</p>
</div>

<div class="drdrop"><input type="button" id="addimg" data-storage="false" value="Загрузить фото в пост" onclick="document.querySelector(&#39;#loadinp&#39;).click()" ></div><input id="loadinp" style="visibility: collapse; width: 0px;" type="file" onchange="upload(this.files[0])"><p></p>

<div class="ptags">
<!--[if lt IE 10]><p><label for="post_tags">Теги через пробел: </label></p><![endif]-->
<p><input type="text" name="post_tags" id="content_tags" value="" placeholder="Теги через пробел" ></p>
</div>

<div class="pperm">
</div>

<div class="additional">
<div class="spoy_load">
<input type="checkbox" id="spoiler_links2" ><label for="spoiler_links2">Расширенные настройки: пермлинк (окончание адреса поста), режим выплаты и бенефициарские. (кликните для показа/скрытия)</label>
 <div class="spoiler_body">
<h2>Расширенные настройки</h2>
<p><label for="user_permlink">Окончание адреса будущего поста (То, что после @логин). Только Английские символы и дефис "-" (Заполнять не обязательно): </label></p>
<p><input type="text" name="user_permlink" id="permlink_filde" data-storage="false" value=""></p>
<?php if ($chain == 'golos' or $chain == 'steem') { ?>
    <p><label for="payouts">Режим выплаты: </label></p>
<p><select name="payouts" id="content_payouts" >
<option selected="selected" value="10000">50% в <?= $amount3 ?> и <?= $amount1 ?>, 50% в <?= $amount2 ?></option>
<option value="0">100% в <?= $amount2 ?></option>
</select></p>
<?php } else if ($chain == 'WLS') { ?>
    <p><label for="payouts">Режим выплаты: </label></p>
    <p><select name="payouts" id="content_payouts" >
    <option selected="selected" value="0">100% в <?= $amount3 ?></option>
</select></p>
<?php } ?>
<hr>
<?php if ($chain != 'viz') { ?>
<h3>Бенефициары</h3>
<p>Вы можете указать других бенефициаров (помимо меня).</p>
<p><label for="benef_login">Логин бенефициара: </label></p>
<p><input name="benef_login" id="nick" placeholder="Введите бенефициара" type="text" ></p>
<p><label for="benef_procent">Процент</label></p>
<p><input name="benef_procent" id="per" placeholder="Введите процент" type="text" ></p>
    <p><button type="button" onclick="add()">Добавить</button></p>
        <div id="out"></div>
<?php } ?>
        </div>
</div>
</div>

<div class="login">
<hr>
<h2>Данные пользователя</h2>
<p><label for="blockchain_login">Ваш логин (без @) в блокчейне <?= $array_url[1] ?>: </label></p>
<p><input type="text" name="blockchain_login" id="blockchain_login" value="" ></p>
<div id="posting_key_block">
<div id="posting_key_form">
<p><label for="posting">Приватный постинг ключ: </label></p>
    <p><input type="password" name="posting" id="posting_key" value=""></p>
    <p><input type="checkbox" id="isSavePosting"> <strong>Сохранить постинг ключ</strong></p>
</div>
<div id="posting_key_delete"><a id="delete_active_key_link">Удалить постинг ключ</a></div>
</div>
<hr>
</div>

<div>
<p><strong><button type="button" onclick="post_submit();"  class="psend">Опубликовать!</button></strong></p>

<p><strong><button type="button" onclick="reset_button();"  class="pclear">Очистка форм поста</button></strong></p>
</div>

</form>

<script src="static/interface.js"></script>
<?php }
?>