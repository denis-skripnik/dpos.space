<button data-fancybox-close class="btn">Закрыть</button>
<?php
$target = $_GET['target'];
$pageUrl = $_GET['pageUrl'];
?>
<script>var target_user = "<?= $target ?>"</script>
<div>
<div id="awards_auth_form">
<form id="auth_form" action="index.html" method="GET"><p class="auth_title"><strong>Пожалуйста авторизируйтесь</strong></p><input type="text" id="this_login" name="viz_login" placeholder="Ваш логин"><br><input type="password" name="posting" id="this_posting" placeholder="Приватный regular ключ"><br><input type="submit" value="Войти"></form>
</div><div id="awards_send_form">
<form id="send_awards_form"><input type="hidden" name="target" id="target" value="<?= $target ?>">
Процент энергии:<br>
<input type="text" id="energy_slider_value" value="2%"><br>
<input type="range" style="width:100%" name="slider_energy_1" id="slider_energy_1" min="1" max="100" step="1" value="2"><br><input type="hidden" name="energy" id="send_energy" value="2">
<input type="hidden" name="custom_sequence" value="0">
Заметка (memo)<br><input type="text" name="memo" value="Награда со страницы просмотра профилей <?= $pageUrl ?>"><br>
<input type="hidden" name="beneficiaries" id="beneficiaries" value="denis-skripnik:2">
<input type="submit" value="Отправить">
</form>
</div>
<script>document.getElementById('slider_energy_1').addEventListener('input', function(){document.getElementById('energy_slider_value').value = this.value+'%'; document.getElementById('send_energy').value = this.value;},false);document.getElementById('slider_energy_1').addEventListener('change', function(){if (20<+this.value){alert('Вы выбрали > 20% энергии. Вам будет доступно мало наград')}}, false)</script>
<div id="main_award_info" style="display: none;"><h4>Результат</h4>
<p id="viz_result_short_msg"></p>
<ul id="long_viz_result" style="display:none;"><li>Направление: <span id="viz_award_target"></span></li>
<li>Затрачиваемый процент энергии: <span id="viz_award_energy"></span>%</li>
<li>Примерная награда в соц. капитал: <span id="viz_award_payout"></span></li>
<li>Осталось энергии на момент последней награды: <span id="account_energy"></span></li>
</ul>
</div>
</div>
<script>
$.getScript("https://dpos.space/blockchains/viz/apps/profiles/award_modal/builder.js");
</script>