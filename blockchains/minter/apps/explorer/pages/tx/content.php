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

$html = file_get_contents('https://explorer-api.minter.network/api/v2/transactions/'.$datas);
$tx = json_decode($html, true)['data'];

date_default_timezone_set('UTC');
$month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
$timestamp1 = $tx['timestamp'];
$timestamp2 = strtotime($timestamp1);
$month1 = date('m', $timestamp2);
$timestamp = date('d', $timestamp2).' '.$month[$month1].' '.date('Y г. H:i:s', $timestamp2);
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
$content = '<h2>Транзакция '.$datas.'</h2>
<ul><li>Блок: <a href="'.$conf['siteUrl'].'minter/explorer/block/'.$tx['height'].'" target="_blank">'.$tx['height'].'</a></li>
<li>Создана: '.$timestamp.'</li>
<li>Тип: '.$types[$tx['type']].'</li>
<li>Отправитель: <a href="'.$conf['siteUrl'].'minter/profiles/'.$tx['from'].'" target="_blank">'.$tx['from'].'</a></li>
<li>Комиссия: '.$tx['gas_coin']['symbol'].' (BIP '.round($tx['fee'], 3).')</li>
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