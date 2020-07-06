<?php
define('REPLYSE_LIMIT', 20);
require_once($_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php');

if (!isset($user) && isset($_REQUEST['options']['user'])) { // проверяем существование элемента
    $user = $_REQUEST['options']['user'];
    } else if (!isset($user) && !isset($_REQUEST['options']['user'])) {
    return;
    }
    
    $site_url = '';
    if (isset($_REQUEST['options']['siteUrl'])) {
        $site_url = $_REQUEST['options']['siteUrl'];
    } else if (isset($conf['siteUrl'])) {
        $site_url = $conf['siteUrl'];
    }

    require 'snippets/GetContentReplies.php';
require_once $_SERVER['DOCUMENT_ROOT'].'/helpers.php';

function generate_html_text($markdown_text){
    $parsedown = new Parsedown();
    $parsedown->setBreaksEnabled(true);
    return $parsedown->text($markdown_text);
}


    $res = $command->execute($commandQuery);

$mass = $res['result'];

$result['content'] = '<div id="ajax_content"><h2>Комментарии пользователя '.$user.'</h2>
<table>
<tr>
<th>Автор поста/комментария</th>
<th>Дата</th>
<th>Текст коммента</th>
<th>Ссылка на комментарий</th>
</tr>';

if (! $mass) {
    $result['content'] = '<p>Результатов нет. Возможно все подходящие операции в истории далеко или такого пользователя не существует. Проверьте правильность написания логина. Сейчас введён: '.$user.'</p>';
    if (isset($_REQUEST['options']) || isset($_GET['options'])) {
        echo json_encode($result);
    return;
    } else {
    return $result['content'];
    }
}

$rowCount = 0;

$next = null;

foreach ($mass as $datas) {
    $op = $datas;
    $parent_author = $op['parent_author'];
    $comment_created1 = $datas['created'];
    $comment_created2 = strtotime($comment_created1);
    $month1 = date('m', $comment_created2);
    $comment_created = date('d', $comment_created2).' '.MONTHS[$month1].' '.date('Y г. H:i:s', $comment_created2);

    $body = $op['body'];
    $permlink = $op['permlink'];
    $parent_permlink = $op['parent_permlink'];

    if ($parent_author && $op['author'] && $body) {

        if ($rowCount === REPLYSE_LIMIT) {
            $next = $permlink;
            break;
        } else {
            $rowCount++;

            $markdown_text = generate_html_text($body);
            $result['content'] .= '<tr>
<td><a href="'.$site_url.'golos/profiles/'.$parent_author.'" target="_blank">'.$parent_author.'</a></td>
<td>'.$comment_created.'</td>
<td>'.$markdown_text.'</td>
<td><a href="https://golos.id/@'.$op['author'].'/'.$permlink.'/#/@'.$parent_author.'/'.$parent_permlink.'" target="_blank">'.$permlink.'</a></td>
</tr>';
        }
    }
}

$result['content'] .= '</table><br /></div>';

$result['nextIsExists'] = ! is_null($next);
if ($result['nextIsExists']) {
    $result['next'] = $next;
}

if (isset($_REQUEST['options']) || isset($_GET['options'])) {
    echo json_encode($result);
} else {
return $result['content'];
}