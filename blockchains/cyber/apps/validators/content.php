<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
try {
    $html = file_get_contents('https://deimos.cybernode.ai/validators?page=1&per_page=100');
    $validators = json_decode($html, true)['result'];
    $list = $validators['validators'];
    $content = '<h2>Блок: <a href="'.$conf['siteUrl'].'cyber/explorer/block/'.$validators['block_height'].'" target="_blank">'.$validators['block_height'].'</a></h2>
<table><thead><tr><th>№</th><th>Адрес</th>
<th>Публичный ключ</th>
<th>Сила Голоса</th>
<th>Приоритет претендента</th></tr></thead><tbody>';
foreach ($list as $num => $validator) {
$num++;
  $content .= '<tr><td>'.$num.'</td>
<td>'.$validator['address'].'</td>
<td>'.$validator['pub_key']['value'].'</td>
<td>'.$validator['voting_power'].'</td>
<td>'.$validator['proposer_priority'].'</td>
</tr>';
}
$content .= '</tbody></table>';
return $content;
} catch (Exception $e) {
  return '<p>Список валидаторов не найден или ошибка соединения с Нодой.</p>';
}
?>