<?php
define('REPLYSE_LIMIT', 50);

@session_start();

    require $_SERVER['DOCUMENT_ROOT'].'/profiles/snippets/GetContentReplies.php';
require_once($_SERVER['DOCUMENT_ROOT'].'/profiles/md/autoload.php');
require_once $_SERVER['DOCUMENT_ROOT'].'/helpers.php';

function generate_html_text($markdown_text){
    $parsedown = new Parsedown();
    $parsedown->setBreaksEnabled(true);
    return $parsedown->text($markdown_text);
}

$user = $array_url[1] ?? false;

if (! $user) {
    die();
}

$res = $command->execute($commandQuery);

$mass = $res['result'];

$result['content'] = '<h2>Комментарии пользователя '.$user.'</h2>
<table>
<tr>
<th>Автор поста/комментария</th>
<th>Дата</th>
<th>Текст коммента</th>
<th>Ссылка на комментарий</th>
</tr>';

if (! $mass) {
    $result['content'] = '<p>такого пользователя не существует. Проверьте правильность написания логина. Сейчас введён: '.$user.'</p>';
    die(json_encode($result));
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
<td><a href="https://dpos.space/profiles/'.$parent_author.'/'.$array_url[2].'" target="_blank">'.$parent_author.'</a></td>
<td>'.$comment_created.'</td>
<td>'.$markdown_text.'</td>
<td><a href="https://'.$client.'/@'.$op['author'].'/'.$permlink.'/#/@'.$parent_author.'/'.$parent_permlink.'" target="_blank">'.$permlink.'</a></td>
</tr>';
        }
    }
}

$result['content'] .= '</table><br />';

$result['nextIsExists'] = ! is_null($next);
if ($result['nextIsExists']) {
    $result['next'] = $next;
}

echo json_encode($result);
