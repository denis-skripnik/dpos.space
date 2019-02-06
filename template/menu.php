<nav id="menu">
<ul>
<?php
if (($chain ?? $chain ?? "") == 'viz') {
    $menu_services = array(
        'profiles' => 'Смотреть профили',
        'tags' => 'Транслит и подбор тегов',
        'calc' => 'Блокчейн-Калькулятор',
        'post' => 'Публиковать посты'
        );
} else {
    $menu_services = array(
        'profiles' => 'Смотреть профили',
        'tags' => 'Транслит и подбор тегов',
        'calc' => 'Блокчейн-Калькулятор',
        'backup' => 'Бекап постов',
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
} else if ($services_urls == 'backup' or $services_urls == 'calc' or $services_urls == 'post') {
$end_url = "$array_url[2]";
} else if ($services_urls == 'tags') {
$end_url = "";
} // end if services_urls.
} else if (!isset($array_url[2]) ){
if ($services_urls == 'profiles' or $services_urls == 'feed' or $services_urls == 'tags' or $services_urls == 'post') {
$end_url = "";
} else if($services_urls == 'backup' or $services_urls == 'calc') {
$end_url = $array_url[1];
} // end if services_urls.
} // end if array_url[2].


echo "<li><a href='https://dpos.space/$services_urls/$end_url' target='_blank'>$services_ankors</a></li>";
}
?>
</ul>
</nav>