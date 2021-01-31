<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
function cmp_function_desc($a, $b){
    return ($a['stake'] < $b['stake']);
  }

try {
    $html = file_get_contents('https://explorer-api.minter.network/api/v2/validators');
    $list = json_decode($html, true)['data'];
uasort($list, 'cmp_function_desc');
$num[1] = 0;
$num[2] = 0;
$validators = [];
$validators[1] = '<h2><a name="1">Кандидаты</a></h2>
<table><thead><tr><th>№</th>
<th>Публичный ключ</th>
<th>Название</th>
<th>Стек</th>
<th>Комиссия</th>
</tr></thead><tbody>';
$validators[2] = '<h2><a name="2">Активные валидаторы</a></h2>
<table><thead><tr><th>№</th>
<th>Публичный ключ</th>
<th>Название</th>
<th>Стек</th>
<th>Комиссия</th>
</tr></thead><tbody>';

foreach ($list as $validator) {
$num[$validator['status']]++;
  if ($validator['status'] === 2 || $validator['status'] === 1) {
    $validators[$validator['status']] .= '<tr><td>'.$num[$validator['status']].'</td>
    <td><input type="text" readonly id="validator_'.$num[$validator['status']].'_key" value="'.$validator['public_key'].'"> (<input type="button" onclick="copyText(`validator_'.$num[$validator['status']].'_key`);" value="копировать">)</td>';
$icon = '';
    if (isset($validator['icon_url']) && $validator['icon_url'] !== '') $icon = '<img src="'.$validator['icon_url'].'" width="100px">';
    if (isset($validator['site_url']) && $validator['site_url'] !== '' && $validator['name'] !== $validator['public_key']) {
      $validators[$validator['status']] .= '<td><a href="'.$validator['site_url'].'" target="_blank">'.$icon.''.$validator['name'].'</a></td>';
    } else if ($validator['name'] === $validator['public_key']) {
      $validators[$validator['status']] .= '<td></td>';
  } else {
    $validators[$validator['status']] .= '<td>'.$validator['name'].'</td>';
    }
    $validators[$validator['status']] .= '<td>'.round($validator['stake'], 3).' BIP (Мин. '.round($validator['min_stake'], 3).')</td>
    <td>'.$validator['commission'].'%</td>
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