<?php

define('POSTS_WITH_PAYMENT_LIMIT', 20);

require_once $_SERVER['DOCUMENT_ROOT'] . '/vendor/autoload.php';
require 'snippets/discussions_by_blog.php';
require 'snippets/get_feed_history.php';
require 'snippets/get_dynamic_global_properties.php';
require 'snippets/get_config.php';

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

    $result = [];
$result['content'] = '<div id="ajax_content"><h2>Посты, получившие выплаты</h2>
<table><tr><th>Название</th>
<th>Время после выплаты</th>
<th>Список бенефициаров и их проценты</th>
<th>Пост оштрафован из-за частой публикации большого количества постов на</th>
<th>Сумма донатов</th>
<th>Сумма выплаты автору</th>
<th>Сумма продвижения</th>
</tr>';

$isNotFirstPage = isset($_REQUEST['start']);
if ($isNotFirstPage) {
    $startAuthor = $_REQUEST['start']['startAuthor'];
    $startPermlink = $_REQUEST['start']['startPermlink'];
}

$feed_res = $feed_command->execute($feed_commandQuery);
$feed_mass = $feed_res['result'];
$base = (float)$feed_mass["current_median_history"]["base"];
$quote = (float)$feed_mass["current_median_history"]["quote"];
$median_price = round($base / $quote, 3);

$res3 = $command3->execute($commandQuery3);
$mass3 = $res3['result'];
$tvfs = (float)$mass3['total_vesting_fund_steem'];
$tvsh = (float)$mass3['total_vesting_shares'];
$steem_per_vests = 1000000 * $tvfs / $tvsh;

$config_res = $config_command->execute($config_commandQuery);
$config_mass = $config_res['result'];

$res = $isNotFirstPage ? DiscussionsByBlog::get($user, POSTS_WITH_PAYMENT_LIMIT, $startAuthor, $startPermlink) :
    DiscussionsByBlog::get($user, POSTS_WITH_PAYMENT_LIMIT);

list($posts, $newStartAuthor, $newStartPermlink) = $res;

if (! $posts) {
    $result['content'] = '<p>Результатов нет. Возможно все подходящие операции в истории далеко или такого пользователя не существует. Проверьте правильность написания логина. Сейчас введён: '.$user.'</p>';
    if (isset($_REQUEST['options']) || isset($_GET['options'])) {
        echo json_encode($result);
    return;
    } else {
    return $result['content'];
    }
}
$sbd_print_rate = $mass3['sbd_print_rate']/10000;
date_default_timezone_set('UTC');
$arr_shtraf_procent = [];
$summ_beneficiaries_pending = 0;
foreach ($posts as $post) {
    $result['content'] .= '<tr>';

    if ($post['author'] == $user) {
        $result['content'] .= '<td><a href="https://golos.id'.$post['url'] . '" target="_blank">' . $post['title'] . '</a></td>';
    } else {
        $result['content'] .= '<td><a href="https://golos.id'.$post['url'] . '" target="_blank">' . $post['title'] . '</a> (Репост от <a href="'.$site_url.'golos/profiles/' . $post['author'] . '" target="_blank">@' . $post['author'] . '</a>)</td>';
    }

    $createdTime = strtotime($post['created']);
    $cashoutTime = $createdTime + 7 * 24 * 60 * 60;
    $deltaTime = time() - $cashoutTime;


    $year_for_pay = date('Y', $deltaTime) - 1970;
    $array_years = ['год', 'года', 'лет'];
    $years_word = getWord($year_for_pay, $array_years);
    $month_for_pay = date('n', $deltaTime) - 1;
    $array_months = ['месяц', 'месяца', 'месяцев'];
    $months_word = getWord($month_for_pay, $array_months);
    $day_for_pay = date("j", $deltaTime) - 1;
    $array_days = array("день", "дня", "дней");
    $days_word = getWord($day_for_pay, $array_days);
    $hours_for_pay = date("G", $deltaTime);
    $array_hours = array("час", "часа", "часов");
    $hours_word = getWord($hours_for_pay, $array_hours);
    $minutes_for_pay = date("i", $deltaTime);
    $array_minutes = array("минута", "минуты", "минут");
    $minute_word = getWord($minutes_for_pay, $array_minutes);


    $dateArray = [
        [$year_for_pay, "$year_for_pay} {$years_word}"],
        [$month_for_pay, "{$month_for_pay} {$months_word}"],
        [$day_for_pay, "{$day_for_pay} {$days_word}"],
        [$hours_for_pay, "{$hours_for_pay} {$hours_word}"],
        [$minutes_for_pay, "{$minutes_for_pay} {$minute_word}"],
    ];

    $n = 0;
    foreach ($dateArray as $i => $unit) {
        if ($unit[0] !== 0) {
            $n = $i;
            break;
        }
    }

    $units = array_slice($dateArray, $n);
    $unitWords = array_map(function($unit) {
        return $unit[1];
    }, $units);

    $result['content'] .= '<td>'.implode(', ', $unitWords).'</td>';

    $all_beneficiaries = 0;
    $beneficiaries_list = '';
    if (isset($post['beneficiaries']) && count($post['beneficiaries']) > 0) {
    foreach ($post['beneficiaries'] as $beneficiarie) {
        $all_beneficiaries += $beneficiarie['weight'];
        $beneficiarie_weight = $beneficiarie['weight'] / 100;
        $beneficiaries_list .= $beneficiarie['account'] . " - " . $beneficiarie_weight . "%  ";
    }
}
    $beneficiaries_procent = $all_beneficiaries / 100;
    $result['content'] .= '<td>' . $beneficiaries_list . '</td>'; // список бенефециаров

    $reward_weight = $post['reward_weight'];
    $reward_weight_procent = $reward_weight / 100;
    $shtraf_procent = 100 - $reward_weight_procent;
    $result['content'] .= '<td>' . round($shtraf_procent, 2) . '%</td>';
    $arr_shtraf_procent[] = $shtraf_procent;
        $result['content'] .= "<td>".$post['donates']." и ".$post['donates_uia']." UIA токенов</td>
<td>".$post['author_payout_in_golos']."</td>
        <td>".$post['promoted']."</td>";
        
    $result['content'] .= '</tr>';
}

$round_days = 'семи дней';
$full_shtraf_procent = round(array_sum($arr_shtraf_procent) / count($arr_shtraf_procent), 2);

$result['content'] .= "<tr><td>Сумма</td>
<td>Все посты, старше $round_days.</td>
<td></td>
<td>$full_shtraf_procent</td>";

$result['nextIsExists'] = ! is_null($newStartAuthor);
if ($result['nextIsExists']) {
    $result['next'] = [
        'startAuthor' => $newStartAuthor,
        'startPermlink' => $newStartPermlink,
    ];
}

$result['content'] .= '</tr></table></div>';

if (isset($_REQUEST['options']) || isset($_GET['options'])) {
    echo json_encode($result);
} else {
return $result['content'];
}