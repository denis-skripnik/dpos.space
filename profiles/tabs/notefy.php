<?php
@session_start();
require $_SERVER['DOCUMENT_ROOT'] . '/profiles/snippets/get_account_history.php';

if (isset($array_url[1])) { // проверяем существование элемента
    $res = $command->execute($commandQuery);

    $mass = $res['result'];

    if ($mass == true) {

        echo '<h2>Уведомления от <a href="https://' . $client . '/@robot" target="_blank">@robot</a> пользователю ' . $array_url[1] . ':</h2>';
        echo '<table><tr>
<th>Дата и время уведомления</th>
<th>Текст</th>
</tr>';
        krsort($mass);
        foreach ($mass as $datas) {
            $op = $datas[1]['op'];
            $from = ($op[1]['from'] ?? "");
            $memo = ($op[1]['memo'] ?? "");
            $memo2 = (preg_replace('#(?<!\])\bhttps://[^\s\[<]+#i',
                    "<a href=\"$0\" target=_blank>$0\</a>",
                    nl2br(stripslashes($memo))) ?? "");
                    $month = array('01' => 'января', '02' => 'февраля', '03' => 'марта', '04' => 'апреля', '05' => 'мая', '06' => 'июня', '07' => 'июля', '08' => 'августа', '09' => 'сентября', '10' => 'октября', '11' => 'ноября', '12' => 'декабря');
        $timestamp1 = $datas[1]['timestamp'];
 $timestamp2 = strtotime($timestamp1);
$month2 = date('m', $timestamp2);
$timestamp = date('j', $timestamp2).' '.$month[$month2].' '.date('Y г. H:i:s', $timestamp2);
					$op1 = $op[1];
            if (isset($op1['from'])) {
                if ($from == 'robot') {
                    echo '<tr><td>'.$timestamp.'</td>
<td>' . $memo2 . '</td>
</tr>';
                }
            }
        }
        echo '</ul>';
    } else {
        echo '<p>такого пользователя не существует. Проверьте правильность написания логина. Сейчас введён: ' . $array_url[1] . '</p>';
    }
}
