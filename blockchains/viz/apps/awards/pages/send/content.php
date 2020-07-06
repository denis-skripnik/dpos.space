<?php
$target = (isset($_GET['target']) ? $_GET['target'] : '');
if (isset($_GET['energy'])) {
    $energy = $_GET['energy'];
    $energy = str_replace(',','.',$energy); //Меняем запятую на точку
    $energy = floatval($energy); //удаляем все лишнее
    $energy = (float)$energy;
    $energy *= 100;
} else {
    $energy = 1;
}
$custom_sequence = (isset($_GET['custom_sequence']) && $_GET['custom_sequence'] !== '' ? $_GET['custom_sequence'] : 0);
$memo = (isset($_GET['memo']) ? $_GET['memo'] : '');
$beneficiaries = (isset($_GET['beneficiaries']) ? $_GET['beneficiaries'] : '');
return '<h2>Страницы сервиса</h2>
<p><span align="left"><a href="'.$conf['siteUrl'].'viz/awards">Форма награждения</a></span> <span align="center"><a href="'.$conf['siteUrl'].'viz/awards/url">генератор url наград и qr-кодов</a></span> <span align="right"><a href="'.$conf['siteUrl'].'viz/awards/builder">Конструктор форм</a></span></p>
<div id="main_award_info"></div>
<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'viz/accounts" target="_blank">здесь</a></p></div>
<script>
send_award(`'.$target.'`, '.$energy.', '.$custom_sequence.', `'.$memo.'`, `'.$beneficiaries.'`);
</script>';
?>