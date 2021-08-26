<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
  $res = file_get_contents('http://138.201.91.11:3852/smartfarm/loto');
  $explorer = file_get_contents('https://api.minter.one/v2/swap_pool/0/2782');
  $pool = json_decode($explorer, true);
$current_price = ((float)$pool['amount0'] / (10 ** 18)) / ((float)$pool['amount1'] / (10 ** 18));
$price_changed = ($current_price - 1) / 1 * 100;
$change_k = (0.2 * ($price_changed / 100)) / 10;
$percent = 0.2 + $change_k;
$l = (float)$pool['liquidity'] / (10 ** 18);
$loto_amount = 2 * ($l / 100) * $percent;
$loto_percent = $loto_amount / $l * 100;

$content = '<p align="center"><strong><a href="/minter/long">К фармингу</a></strong></p>
<p>О LONG вы сможете узнать на странице фарминга. Здесь же про лотерею проекта.</p>
<h2>О лотерее проекта LONG (<a href="/minter/long/phelosophy" target="_blank">философия проекта</a>)</h2>
<p><strong>Проводится каждый день в случайное время.</strong></p>
<ol><li>Сумма выигрыша = 2 * (сумма всех LP токенов / 100) * текущий процент провайдера (учитывает курс LONG и инвест. дни)<br>
<strong>Сумма без учёта инвест. дней провайдера: '.round($loto_amount, 5).' LONG ('.round($loto_percent, 5).'%)</strong></li>
<li>Собирается список топ 100 провайдеров пула</li>
<li>Каждому выдаются билеты. Количество = (LP-токены провайдера / 100) * (1 + (инвест_дни / 100)) с переводом в целое число,<br>
Где<br>
инвест_дни - число инвестиционных дней провайдера пула (СМ. страницу фарминга для подробностей).</li>
<li>После этого билеты случайным образом перемешиваются. После чего выбирается случайный победитель на основе ГСЧ с использованием Minter блокчейна (СМ. <a href="/minter/randomblockchain" target="_blank">сервис</a>).</li>
</ol>
<hr>
<h3><a name="contents">Оглавление</a></h3>
<ul><li><a href="#tickets">Билеты</a></li>
<li><a href="#winners">История победителей</a></li>
</ul>
<hr>
<h3><a name="tickets">Список билетов</a></h3>
<p>'.$res.'</p>
<hr>
<p align="center"><a href="#contents">К оглавлению</a></p>
<h3><a name="winners">История победителей</a></h3>
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
if (strpos($memo, 'лотерее') === false) {
  continue;
}
      $to = (isset($tx['data']['to']) ? $tx['data']['to'] : $tx['data']['list'][0]['to']);
    $amount = round((float)(isset($tx['data']['value']) ? $tx['data']['value'] : $tx['data']['list'][0]['value']), 5).' LONG';
     $timestamp1 = $tx['timestamp'];
     $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$datetime = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);
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