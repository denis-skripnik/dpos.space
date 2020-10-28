<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<p><span align="center"><a href="'.$conf['siteUrl'].'viz/search/add-link">добавить ссылку</a></span></p>
<form method = "post" action = "">
<input type = "hidden" name = "chain" value = "viz">
<input type = "hidden" name = "service" value = "search">
<p><label for="type">Тип поиска: </label>
<p><label><input type="radio" name="type" value="full_search"> С точным совпадением</label><br>
<label><input type="radio" name="type" value="unfull_search"> С поиском запроса в анкорах ссылок</label></p>
<p><label for = "search">Поисковый запрос: </br>
<input type = "text" name = "search" value="" placeholder="Введите поисковый запрос"></label></p>
<p><input type = "submit" value = "Найти"/></p>
</form>
'; ?>