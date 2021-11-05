<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
try {
  function convert_operation_data($arr, $site_url) {
    $result = '{<br />';
        if (isset($arr['list'])) {
          foreach ($arr['list'] as $multy) {
foreach ($multy as $key => $val) {
  if ($key === 'from' || $key === 'initiator' || $key === 'receiver' || $key === 'to' || $key === 'account' || $key === 'owner' || $key === 'publisher' || $key === 'author') {
    $result .= $key.': "<a href="'.$site_url.'decimal/profiles/'.$val.'" target="_blank">'.$val.'</a>";';
  } else if ($key === 'value') {
    $result .= 'Количество: '.round($val, 3).';';
    } else if ($key === 'coin') {
    $result .= 'Монета: '.$val['symbol'].';';
  } else {
  if (is_array($val)) {
    $val = json_encode($val);
  }  
  $result .= $key.': "'.$val.'";';
}
            }
            }
          } else {
          foreach ($arr as $key => $val) {
              if ($key === 'from' || $key === 'initiator' || $key === 'receiver' || $key === 'to' || $key === 'account' || $key === 'owner' || $key === 'publisher' || $key === 'author') {
                $result .= $key.': "<a href="'.$site_url.'decimal/profiles/'.$val.'" target="_blank">'.$val.'</a>";';
              } else if ($key === 'value') {
                $result .= 'Количество: '.round($val, 3).';';
                } else if ($key === 'coin') {
                $result .= 'Монета: '.$val.';';
              } else {
              if (is_array($val)) {
                $val = json_encode($val);
              }  
              $result .= $key.': "'.$val.'";';
            }
                                                }
                      }
      $result = str_replace(array(";"), ",<br />", $result);
  $result = substr($result, 0, -7);
      $result .= '<br />}';
      return $result;
  }

  $html = file_get_contents('https://mainnet-gate.decimalchain.com/api/tx/'.$datas);
$tx = json_decode($html, true)['result'];

date_default_timezone_set('UTC');
$month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
$timestamp1 = $tx['timestamp'];
$timestamp2 = strtotime($timestamp1);
$month1 = date('m', $timestamp2);
$timestamp = date('d', $timestamp2).' '.$month[$month1].' '.date('Y г. H:i:s', $timestamp2);
$content = '<h2>Транзакция '.$datas.'</h2>
<ul><li>Блок: <a href="'.$conf['siteUrl'].'decimal/explorer/block/'.$tx['blockId'].'" target="_blank">'.$tx['blockId'].'</a></li>
<li>Создана: '.$timestamp.'</li>
<li>Тип: '.$tx['type'].'</li>
<li>Отправитель: <a href="'.$conf['siteUrl'].'decimal/profiles/'.$tx['from'].'" target="_blank">'.$tx['from'].'</a></li>
<li>Комиссия: '.$tx['fee']['gas_coin'].' (DEL '.round($tx['fee'], 3).')</li>
</ul>';

  $tx_data = convert_operation_data($tx['data'], $conf['siteUrl']);
$content .= '<hr />
  <h3>Данные</h3>
<p>'.$tx_data.'</p>';

return $content;
} catch (Exception $e) {
  return '<p>Такой транзакции нет.</p>';
}
?>