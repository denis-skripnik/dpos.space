<?php return '
<div id="posting_page">
<h2>Адрес публичной Ноды</h2>
<p>Ниже вы можете указать произвольный адрес публичной Ноды. После сохранения обновите страницу.</p>
<form>
<p><label for="node_url">Адрес Ноды: </label>
<input type="text" name="node_url" id="public_node" value="">
<button type="button" id="submit_node">Сохранить</button>
</form>
<hr>
<h1>Публикация поста <br><strong>Бенефициарские 1%</strong></h1>

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
<input type="text" id="postediturl" name="postedit" placeholder="https://hiveit.com/tag/@user/permlink">
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

<div class="ptags">
<!--[if lt IE 10]><p><label for="post_tags">Теги через пробел: </label></p><![endif]-->
<p><input type="text" name="post_tags" id="content_tags" value="" placeholder="Теги через пробел" ></p>
<div class="spoy_load">
<input type="checkbox" id="spoiler_linksTags" ><label for="spoiler_linksTags">Популярные теги. (кликните для показа/скрытия)</label>
 <div class="spoiler_body">
 <table border="1" cellpadding="5" width="100%"><thead>
    <tr>
     <th colspan="3">Теги</th>
    </tr></thead><tbody>
         <tr>
         <td><button type="button" class="popular_tags" id="tag1" value="liga-avtorov">Лига авторов</button></td>
         <td><button type="button" class="popular_tags" id="tag2" value="vp-liganovi4kov">Лига новичков</button></td>
         <td><button type="button" class="popular_tags" id="tag3" value="ladyzarulem">ladyzarulem</button></td>
         <td><button type="button" class="popular_tags" id="tag4" value="psk">psk</button></td>
         </tr>
         <tr>
         <td><button type="button" class="popular_tags" id="tag5" value="chaos-legion">Легион хаоса</button></td>
         <td><button type="button" class="popular_tags" id="tag6" value="ru--megagalxyan">Мегагальян</button></td>
         <td><button type="button" class="popular_tags" id="tag7" value="botbod">Проект БОД</button></td>
         <td><button type="button" class="popular_tags" id="tag8" value="boonmood">boonmood</button></td>
         </tr>
         <tr>
         <td><button type="button" class="popular_tags" id="tag9" value="hive">Hive</button></td>
         <td><button type="button" class="popular_tags" id="tag10" value="blockchain">Блокчейн</button></td>
         <td><button type="button" class="popular_tags" id="tag11" value="vox-populi">vox-populi</button></td>
         <td><button type="button" class="popular_tags" id="tag12" value="earth-citizens">Граждане Земли</button></td>
         </tr>
   </tbody></table>
</div></div>
</div>

<div class="pperm">
</div>

    <p><label for="payouts">Режим выплаты: </label></p>
<p><select name="payouts" id="content_payouts" >
<option selected="selected" value="10000">50% в HBD и HIVE, 50% в HP</option>
<option value="0">100% в HP</option>
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

<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'hive/accounts" target="_blank">здесь</a></p></div>

<div>
<p><strong><button type="button" onclick="post_submit();"  class="psend">Опубликовать!</button></strong></p>

<p><strong><button type="button" onclick="reset_button();"  class="pclear">Очистка форм поста</button></strong></p>
</div>

</form>
</div>
<script src="'.$conf['siteUrl'].'blockchains/hive/apps/post/js/_interface.js"></script>
'; ?>