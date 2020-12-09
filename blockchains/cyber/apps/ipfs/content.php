<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<h2>Добавить файл в IPFS</h2>
<h3>Способ 1: загрузить</h3>
<label class="custom-file-upload"><input id="files" type="file">Загрузить файл</label>
<div id="upload_result"></div>
<h3>Способ 2: введите текст</h3>
<form class="form">
<p><input type="text" id="text_to_ipfs" placeholder="Введите текст"></p>
<div id="text_result"></div>
<p><input type="button" name="add_text_to_ipfs" value="Отправить"></p>
</form>
'; ?>