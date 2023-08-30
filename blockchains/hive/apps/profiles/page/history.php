<?php
return '<div>
<form name="filter" id="filter">
<p><label for="ops">Выберите операции:<br>
<select multiple id="ops" name="ops">
    </select></label></p>
<p><label for="query">Введите произвольный запрос:<br>
<input type="text" id="query" name="query" value="" placeholder="Введите запрос"></label></p>
<p><strong><input type="button" id="get_results" value="Показать"></strong></p>
</form></div>
<h2>История аккаунта '.$user.'</h2>
<p><b>Загружается за раз 100 элементов истории, а затем фильтруется по операциям и запросу. Поэтому если нет прибавки, кликайте ещё раз по ссылке "Ещё".<br>
Глубина истории <span id="history_level">0</span> элементов.</b></p>
<table><thead><tr>
<th>Дата</th>
<th>Название операции</th>
<th>Данные</th>
</tr></thead>
<tbody id="items"></tbody></table>
<p><strong><a onclick="getHistory()">Ещё</a></strong></p>
'; ?>