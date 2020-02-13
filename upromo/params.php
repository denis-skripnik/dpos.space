<?php
if (($array_url[0] ?? $array_url[0] ?? "") == 'upromo') {
    if (!isset($array_url[1]) && !isset($chain)) {
        $title = "Менеджер UPromo | $title_domain";
        $meta_keywords = "golos, upromo, промо, сервис";
        $meta_description = "Страница сервиса upromo.";
        $h1 = "UPromo";
        $description = '<p>Всё, что касается сервиса UPRomo.</p>';
    } else if (!isset($array_url[1]) && !isset($array_url[2])) {
        $title = "Менеджер UPromo | $title_domain";
        $meta_keywords = "golos, upromo, промо, сервис";
        $meta_description = "Страница сервиса upromo.";
        $h1 = "UPromo";
        $description = '<p>Страницы работы с сервисом UPRomo.</p>';
    } else if ($array_url[1] == 'promo-codes') {
        $title = "Промокоды UPRomo | $title_domain";
        $meta_keywords = "golos, upromo, промо, сервис";
        $meta_description = "Страница промокодов сервиса upromo.";
        $h1 = "UPromo";
        $description = '<p>Страницы работы с сервисом UPRomo.</p>';
        $profiles_script = '';

    }
    $footer_text = "просматривать список постов";
} // Конец условия для данного сервиса