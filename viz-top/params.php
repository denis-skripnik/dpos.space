<?php
if (($array_url[0] ?? $array_url[0] ?? "") == 'viz-top') {
    if (!isset($array_url[1]) && !isset($chain)) {
        $title = "Топ пользователей Viz | $title_domain";
        $meta_keywords = "Viz, топ, пользователи, юзеры";
        $meta_description = "Страница топа пользователей Viz";
        $h1 = "Топ пользователей блокчейна Viz";
        $description = '<p>Топ по VIZ и SHARES.</p>';
    } else if (!isset($array_url[1]) && !isset($array_url[2])) {
        $title = "Топ пользователей Viz | $title_domain";
        $meta_keywords = "Viz, топ, пользователи, юзеры";
        $meta_description = "Страница топа пользователей Viz";
        $h1 = "Топ пользователей блокчейна Viz";
        $description = '<p>Топ по VIZ и SHARES.</p>';
    } else if (strtoupper($array_url[1]) == 'VIZ') {
        $title = "Топ пользователей Viz по токену VIZ | $title_domain";
        $meta_keywords = "Viz, топ, блокчейн, виз";
        $meta_description = "Топ пользователей блокчейна Viz по токену VIZ.";
        $h1 = "Топ по токену VIZ";
        $description = '<p>Топ 100 пользователей, отсортированных по токену VIZ.</p>';
    } else if (strtoupper($array_url[1]) == 'SHARES') {
        $title = "Топ пользователей Viz по SHARES | $title_domain";
        $meta_keywords = "Viz, топ, SHARES, доля";
        $meta_description = "Топ пользователей Viz по SHARES.";
        $h1 = "Топ по SHARES";
        $description = '<p>Топ 100 пользователей, отсортированных по SHARES.</p>';
    }
    $footer_text = "просматривать топ Viz по токенам";
} // Конец условия для данного сервиса