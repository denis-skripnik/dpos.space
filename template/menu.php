<nav id="menu">
<ul>
<?php
if (($chain ?? $chain ?? "") == 'viz') {
    $menu_services = array(
        'profiles' => 'Смотреть профили',
        'tags' => 'Транслит и подбор тегов',
        'calc' => 'Блокчейн-Калькулятор',
        'viz-top' => 'Посмотреть топ пользователей Viz',
        'post' => 'Публиковать посты'
        );
    } else {
    $menu_services = array(
        'profiles' => 'Смотреть профили',
        'golos-top' => 'Посмотреть топ пользователей Голоса',
        'golos-polls' => 'Участвовать в опросах на Голосе',
        'golos-donates' => 'Топ донатов и донатящих',
        'tags' => 'Транслит и подбор тегов',
        'calc' => 'Блокчейн-Калькулятор',
        'feed' => 'Читать подписчиков',
        'post' => 'Публиковать посты'
    );
}

foreach ($menu_services as $services_urls => $services_ankors) {
if (!isset($array_url[1]) ){
$end_url = "";
} else if (!isset($array_url[1]) and !isset($array_url[2]) ){
$end_url = "";
} else if ( isset($array_url[2]) ){
if ($services_urls == 'profiles' or $services_urls == 'feed') {
$end_url = "$array_url[1]/$array_url[2]";
} else if ($services_urls == 'calc' or $services_urls == 'post') {
$end_url = "$array_url[2]";
} else if ($services_urls == 'tags' or $services_urls == 'golos-top'  or $services_urls == 'golos-polls'  or $services_urls == 'golos-donates' or $services_urls == 'viz-top') {
$end_url = "";
} // end if services_urls.
} else if (!isset($array_url[2]) ){
if ($services_urls == 'profiles' or $services_urls == 'feed' or $services_urls == 'tags' or $services_urls == 'post' or $services_urls == 'golos-top' or $services_urls == 'golos-polls' or $services_urls == 'golos-donates' or $services_urls == 'viz-top') {
$end_url = "";
} else if($services_urls == 'calc') {
$end_url = $array_url[1];
} // end if services_urls.
} // end if array_url[2].


echo "<li><a href='/$services_urls/$end_url'>$services_ankors</a></li>";
}
?>
</ul>
</nav>