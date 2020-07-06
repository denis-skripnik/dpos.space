<?php
$user = $_GET['options']['user'];
$siteUrl = $_GET['options']['siteUrl'];
if ($_REQUEST['options']['type'] === 'followers') {
require 'snippets/Get_Followers.php';
} else {
    require 'snippets/Get_Followings.php';
}
$res4 = $command4->execute($commandQuery4);

$mass4 = $res4['result'];

// ответ для браузера
$result = [];

// если мы брали на одного подписчика больше - нужно его убрать
if (count($mass4) > FOLLOWERS_LIMIT) {
    $result['nextIsExists'] = true;
    $next = array_pop($mass4);
    $result['next'] = $next['follower'];
} else {
    $result['nextIsExists'] = false;
}

$result['content'] = '<div id="followers_content">';
if (isset($user)) { // проверяем существование элемента
    if ($_REQUEST['options']['type'] === 'followers') {
    $result['content'] .= '<h2>Подписчики пользователя ' . $user . '</h2>
<ol>';
foreach ($mass4 as $datas4) {
    $result['content'] .= '<li><a href="'.$siteUrl.'golos/profiles/'.$datas4['follower'].'" target="_blank">'.$datas4['follower'].'</a></li>';
}
$result['content'] .= '</ol>';    
} else {
        $result['content'] .= '<h2>' . $user . ' подписался на следующих пользователей</h2>
<ol>';
foreach ($mass4 as $datas4) {
            $result['content'] .= '<li><a href="'.$siteUrl.'golos/profiles/'.$datas4['following'].'" target="_blank">'.$datas4['following'].'</a></li>';
        }
$result['content'] .= '</ol>';
    }
} else {
    $result['content'] .= '<p>такого пользователя не существует. Проверьте правильность написания логина. Сейчас введён: ' . $user . '</p>';
}

$result['content'] .= '</div>
<p><button data-fancybox-close class="btn">Закрыть</button></p>';

echo json_encode($result);
