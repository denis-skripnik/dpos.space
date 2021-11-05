<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
function cmp_function_desc($a, $b){
    return ($a['stake'] < $b['stake']);
  }

try {
    $html = file_get_contents('https://mainnet-explorer-api.decimalchain.ru/api/validators/validator');
    $list = json_decode($html, true)['result'];
$num['online'] = 0;
$num['offline'] = 0;
$validators = [];
$validators[1] = '<h2><a name="1">Кандидаты</a></h2>
<table><thead><tr><th>№ статус</th>
<th>Адрес</th>
<th>Название</th>
<th>Stake</th>
<th>Комиссия</th>
<th>Пропущено блоков</th>
</tr></thead><tbody>';
$validators[2] = '<h2><a name="2">Активные валидаторы</a></h2>
<table><thead><tr><th>№ Статус</th>
<th>Адрес</th>
<th>Название</th>
<th>Stake</th>
<th>Комиссия</th>
<th>Пропущено блоков</th>
</tr></thead><tbody>';
uasort($list['validators'], 'cmp_function_desc');
foreach ($list['validators'] as $validator) {
    $num[$validator['status']]++;
    if ($validator['status'] === 'online' || $validator['status'] === 'offline') {
    $validators[2] .= '<tr><td>'.$num[$validator['status']].' '.$validator['status'].'</td>
    <td><input type="text" readonly id="validator_'.$num[$validator['status']].'_key" value="'.$validator['address'].'"> (<input type="button" onclick="copyText(`validator_'.$num[$validator['status']].'_key`);" value="копировать">)</td>';
$icon = '';
    if (isset($validator['icon_url']) && $validator['icon_url'] !== '') $icon = '<img src="'.$validator['icon_url'].'" width="100px">';
    if (isset($validator['website']) && $validator['website'] !== '' && $validator['moniker'] !== $validator['address']) {
      $validators[2] .= '<td><a href="'.$validator['website'].'" target="_blank">'.$icon.''.$validator['moniker'].'</a></td>';
    } else if ($validator['moniker'] === $validator['address']) {
      $validators[2] .= '<td></td>';
  } else {
    $validators[2] .= '<td>'.$validator['moniker'].'</td>';
    }
    $stake = $validator['stake'] / (10 ** 18);
    $mins = $validator['mins'] / (10 ** 18);
    $fee = $validator['fee'] * 100;
    $validators[2] .= '<td>'.round($stake, 3).' DEL (Мин. '.round($mins, 3).')</td>
    <td>'.round($fee, 2).'%</td>
  <td>'.$validator['skippedBlocks'].'</td>
</tr>';
}
}

$html = file_get_contents('https://mainnet-explorer-api.decimalchain.ru/api/validators/candidate');
$candidates = json_decode($html, true)['result'];
uasort($candidates['validators'], 'cmp_function_desc');
foreach ($candidates['validators'] as $validator) {
    $num[$validator['status']]++;
    if ($validator['status'] === 'online' || $validator['status'] === 'offline') {
    $validators[1] .= '<tr><td>'.$num[$validator['status']].' '.$validator['status'].'</td>
    <td><input type="text" readonly id="validator_'.$num[$validator['status']].'_key" value="'.$validator['address'].'"> (<input type="button" onclick="copyText(`validator_'.$num[$validator['status']].'_key`);" value="копировать">)</td>';
$icon = '';
    if (isset($validator['icon_url']) && $validator['icon_url'] !== '') $icon = '<img src="'.$validator['icon_url'].'" width="100px">';
    if (isset($validator['website']) && $validator['website'] !== '' && $validator['moniker'] !== $validator['address']) {
      $validators[1] .= '<td><a href="'.$validator['website'].'" target="_blank">'.$icon.''.$validator['moniker'].'</a></td>';
    } else if ($validator['moniker'] === $validator['address']) {
      $validators[1] .= '<td></td>';
  } else {
    $validators[1] .= '<td>'.$validator['moniker'].'</td>';
    }
    $stake = $validator['stake'] / (10 ** 18);
    $mins = $validator['mins'] / (10 ** 18);
    $fee = $validator['fee'] * 100;
    $validators[1] .= '<td>'.round($stake, 3).' DEL (Мин. '.round($mins, 3).')</td>
    <td>'.round($fee, 2).'%</td>
  <td>'.$validator['skippedBlocks'].'</td>
</tr>';
}
}

$validators[1] .= '</tbody></table>
<p align="center"><a href="#contents">К оглавлению</a></p>';
$validators[2] .= '</tbody></table>
<p align="center"><a href="#contents">К оглавлению</a></p>';
$content = '<h2><a name="contents">Оглавление</a></h2>
<ul><li><a href="#2">Активные</a></li>
<li><a href="#1">Кандидаты</a></li></ul>
'.$validators[2].'
'.$validators[1];
return $content;
} catch (Exception $e) {
  return '<p>Список валидаторов не найден или ошибка соединения с Нодой.</p>';
}
?>