<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
      $url = pageUrl();
      $loto_date = gmdate("Y-m-d");
      if (isset($url[3])) $loto_date = $url[3];
   $res = file_get_contents('http://138.201.91.11:3852/smartfarm/loto?date='.$loto_date);

$content = '<p align="center"><strong><a href="/minter/long">К фармингу</a></strong></p>
<p>О LONG вы сможете узнать на странице фарминга. Здесь же про лотерею проекта.</p>
<h2>О лотерее проекта LONG (<a href="/minter/long/phelosophy" target="_blank">философия проекта</a>)</h2>
<p><strong>Проводится каждый день в случайное время.</strong></p>
<ol><li>Сумма выигрыша = (сумма LP токенов провайдера / 2) * текущий процент провайдера (учитывает курс LONG и инвест. дни / 100), но не более 50000 LONG</li>
<li>Собирается список топ 100 провайдеров пула</li>
<li>Проверяется, сделали ли реинвест:<br>
<strong>Если выиграли вчера, >= 50% от суммы получения, если не выиграли - >= 49% фарминга.</strong></li>
<li>Основное смотрите в подробностях лотереи.</li>
</ol>
<hr>
<h2><a name="contents">Оглавление</a></h2>
<ul><li><a href="#info">Подробности</a></li>
<li><a href="#history">Предыдущие лотереи</a></li>
</ul>
<hr>
<h2><a name="info">Подробности</a></h2>
<p>'.$res.'</p>
<hr>
<p align="center"><a href="#contents">К оглавлению</a></p>
<h2><a name="history">Предыдущие лотереи</a></h2>';
$start = strtotime('2021-10-29 GMT');
$finish = time();
$date_line = $finish - $start;
if ($date_line >= 86400) {
  $content .= '<ul>';
  for($i=$start; $i < $finish; $i+=86400){
    $now_date = gmdate("Y-m-d", $i);
    if ($now_date === gmdate("Y-m-d")) continue;
    $content .= '<li><a href="/minter/long/loto/'.$now_date.'" target="_blank">'.$now_date.'</a></li>
';
}
$content .= '</ul>';
}
$content .= '<hr>
<p align="center"><a href="#contents">К оглавлению</a></p>
<h2><a name="winners">История победителей</a></h2>
<table><thead><tr>
<th>Дата и время</th>
<th>Адрес</th>
<th>Сумма</th>
<th>Номер билета</th>
</tr></thead><tbody>';
$txs = file_get_contents('https://explorer-api.minter.network/api/v2/addresses/Mx01029d73e128e2f53ff1fcc2d52a423283ad9439/transactions');
$txs_res = json_decode($txs, true)['data'];
if (isset($txs_res) && count($txs_res) > 0) {
  $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
    foreach($txs_res as $tx) {
    if ($tx['from'] === 'Mx01029d73e128e2f53ff1fcc2d52a423283ad9439' && ($tx['type'] === 1 && $tx['data']['coin']['symbol'] === 'LONG' || $tx['type'] === 13 && $tx['data']['list'][0]['coin']['symbol'] === 'LONG')) {
      $memo = base64_decode($tx['payload']);
if (strpos($memo, 'Вы победили в лотерее пула BIP-LONG') === false || strpos($memo, 'билет') === false) {
  continue;
}
      $to = (isset($tx['data']['to']) ? $tx['data']['to'] : $tx['data']['list'][0]['to']);
    $amount = (float)(isset($tx['data']['value']) ? $tx['data']['value'] : $tx['data']['list'][0]['value']);
     $amount = number_format($amount, 2, ',', '&nbsp;').' LONG';
    $timestamp1 = $tx['timestamp'];
     $timestamp2 = strtotime($timestamp1);
$month2 = gmdate('m', $timestamp2);
$datetime = gmdate('j', $timestamp2).' '.$month[$month2].' '.gmdate('Y г. H:i:s', $timestamp2);
$memo2 = explode("номером ", $memo)[1];
$ticker_number = explode('.', $memo2)[0];
     $content .= '<tr>
<td>'.$datetime.' по МСК</td>
    <td><a href="/minter/profiles/'.$to.'" target="_blank">'.$to.'</a></td>
<td>'.$amount.'</td>
<td>'.$ticker_number.'</td>
</tr>';
    }
  }
}
$content .= '</tbody></table>
<p align="center"><a href="#contents">К оглавлению</a></p>';
return $content;
?>