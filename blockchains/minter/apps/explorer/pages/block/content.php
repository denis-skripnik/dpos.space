<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
try {
  function convert_operation_data($arr, $site_url) {
    $result = '{<br />';
        if (isset($arr['list'])) {
          foreach ($arr['list'] as $multy) {
foreach ($multy as $key => $val) {
  if ($key === 'from' || $key === 'initiator' || $key === 'receiver' || $key === 'to' || $key === 'account' || $key === 'owner' || $key === 'publisher' || $key === 'author') {
    $result .= $key.': "<a href="'.$site_url.'minter/profiles/'.$val.'" target="_blank">'.$val.'</a>";';
  } else if ($key === 'value') {
    $val = $val / (10 ** 18);
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
                $result .= $key.': "<a href="'.$site_url.'minter/profiles/'.$val.'" target="_blank">'.$val.'</a>";';
              } else if ($key === 'value') {
                $val = $val / (10 ** 18);
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
      $result = str_replace(array(";"), ",<br />", $result);
  $result = substr($result, 0, -7);
      $result .= '<br />}';
      return $result;
  }
  
  function node($params) {
    $html = file_get_contents('https://api.minter.one/v2/'.$params);
    $data = json_decode($html, true);
  return $data;
  }
$block = node('block/'.$datas);

  date_default_timezone_set('UTC');
$month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
$timestamp1 = $block['time'];
$timestamp2 = strtotime($timestamp1);
$month1 = date('m', $timestamp2);
$timestamp = date('d', $timestamp2).' '.$month[$month1].' '.date('Y г. H:i:s', $timestamp2);
$prev_block = $datas-1;
$next_block = $datas+1;

  $content = '<h2>Блок №'.$datas.' (<a href="'.$conf['siteUrl'].'minter/explorer/block/'.$prev_block.'" target="_blank">← предыдущий</a>, <a href="'.$conf['siteUrl'].'minter/explorer/block/'.$next_block.'" target="_blank">→ следующий</a>)</h2>
<h3>Транзакции</h3>
<ol>';
$txs = node('block/'.$datas)['transactions'];
$types = [
  1 => 'Отправка',
  2 => 'Продажа монеты',
  3 => 'Продажа всех монет',
  4 => 'Покупка монет',
  5 => 'Создание монеты',
  6 => 'Объявление кандидата в валидаторы',
  7 => 'Делегирование',
  8 => 'Анбонд',
  9 => 'Получение чека',
  10 => 'Установка кандидата в статусе онлайн',
  11 => 'Установка кандидата в статусе оффлайн',
  12 => 'Создание мультисига',
  13 => 'Мультисенд (мульти-отправка)',
  14 => 'Редактирование кандидата',
  15 => 'Установка блока остановки',
  16 =>  'Пересоздание монеты',
  17 =>  'Изменение владельца монеты',
  18 =>  'Редактирование мультисига',
  19 =>  'Голосование за цену',
  20 =>  'Изменение публичного ключа кандидата',
  21 =>  'Добавление ликвидности',
  22 =>  'Удаление ликвидности',
  23 =>  'Продажа через пул',
  24 =>  'Покупка через пул',
  25 =>  'Продажа всех монет через пул',
  26 =>  'Покупка всех монет через пул',
  27 =>  'Изменение комиссии кандидата',
  28 =>  'Перемещение стейка',
  29 =>  'Эмиссия токена',
  30 =>  'Сжигание токена',
  31 =>  'Создание токена',
  32 =>  'Пересоздание токена',
  33 =>  'Голосование за комиссию',
  34 =>  'Голосование за обновление',
  35 =>  'Создание пула ликвидности'
];
foreach ($txs as $num => $tr) {
  $content .= '<li><h3>Хеш: <a href="'.$conf['siteUrl'].'minter/explorer/tx/'.$tr['hash'].'" target="_blank">'.$tr['hash'].'</a></h3>
<table><tr><th>Тип транзакции</th>
  <th>JSON</th></tr>';
  if (isset($tr[0])) {
    foreach ($tr['data'] as $op) {
      $op_data = convert_operation_data($op, $conf['siteUrl']);
        $content .= '<tr><td>'.$types[$tr['type']].'</td>
      <td>'.$op_data.'</td></tr>';
        }
  } else {
    $op_data = convert_operation_data($tr['data'], $conf['siteUrl']);
    $content .= '<tr><td>'.$types[$tr['type']].'</td>
  <td>'.$op_data.'</td></tr>';
  }
  $content .= '</table></li>';
}
$content .= '</ol>

<hr>
<h2>Информация о блоке</h2>
<ul><li>Сформирован '.$timestamp.' GMT</li>
<li>Предложил блок: '.$block['proposer'].'</li></ul>';
return $content;
} catch (Exception $e) {
  return '<p>Такого блока нет или ошибка соединения с Нодой.</p>';
}
?>