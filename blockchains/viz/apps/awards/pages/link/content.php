<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
global $conf;
$url = pageUrl();
$content = '<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">здесь</a></p></div>
<div id="posting_page">
<h2>Заполните поля, чтобы отправить награду</h2>
<h3 id ="now_energy"></h3>
<form class="form" id="award_user_form" action="'.$conf['siteUrl'].'viz/awards/send/" method="get">';
if (isset($url[3])) {
$content .= '<input type="hidden" name="target" value="'.$url[3].'">';
$data['title'] .= ' '.$url[3];
} else {
	$content .= '<p><label for="target">Кого наградить:</label>
<input type="text" name="target" value="" placeholder="Введите получателя награды"></p>';
}
if (isset($url[4])) {
	$content .= '<input type="hidden" min="0" name="custom_sequence" value="'.$url[4].'">';
} else {
	$content .= '<p><label for="custom_sequence">Номер Custom операции, отправленной пользователем, которому предназначена награда (в принципе, можно указать любое число, например, id новости, опубликованной пользователем, в базе данных вашего сайта):</label>
	<input type="number" min="0" name="custom_sequence" value="" placeholder="номер custom операции"></p>';
}
if (isset($url[5])) {
	$memo_array = explode('/', $_SERVER['REQUEST_URI'], 7);
	$memo = urldecode($memo_array[6]);
		$memo = explode('/', $memo)[0];
	$content .= '<p><label for="memo">Заметка (memo):</label></p>
	<p><input type="text" readonly name="memo" value="'.$memo.'" placeholder="Заметка к награде"></p>';
} else {
	$content .= '<p><label for="memo">Заметка (memo):</label></p>
	<p><input type="text" name="memo" value="" placeholder="Введите заметку к награде"></p>';
}
if (isset($url[6]) && (float)$url[6] <= 100) {
	$content .= '<p><label for="energy">Процент энергии, который вы готовы потратить при награде. Энергия регенерирует за сутки на 20%:</label>
	<input type="text" name="energy" id="awarding_energy" value="'.$url[6].'" required placeholder="Введите процент энергии без знака %">%</p>';
} else {
	$content .= '<p><label for="energy">Процент энергии, который вы готовы потратить при награде. Энергия регенерирует за сутки на 20%:</label>
	<input type="text" name="energy" id="awarding_energy" value="" required placeholder="Введите процент энергии без знака %">%</p>';
}
if (isset($url[7])) {
	$checked = '';
	if ($url[7] == "true") $checked = ' checked';
	$content .= '<p><label for="isFixed">Фиксированная в VIZ награда</label>
	<input type="checkbox" name="isFixed" id="isFixed"'.$checked.'></p>';
} else {
$content .= '<p><label for="isFixed">Фиксированная в VIZ награда</label>
<input type="checkbox" name="isFixed" id="isFixed"></p>';
}
$content .= '<p><strong><input type="submit" value="Наградить"></strong></p>
</form>
<script>
accountData();
</script>
</div>';
return $content;
?>