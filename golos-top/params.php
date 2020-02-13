<?php
if (($array_url[0] ?? $array_url[0] ?? "") == 'golos-top') {
    if (!isset($array_url[1]) && !isset($chain)) {
        $title = "Топ пользователей Голоса | $title_domain";
        $meta_keywords = "Golos, топ, пользователи, юзеры";
        $meta_description = "Страница топа пользователей Голоса";
        $h1 = "Топ пользователей Голоса";
        $description = '<p>Топ по СГ, GBG и GOLOS.</p>';
    } else if (!isset($array_url[1]) && !isset($array_url[2])) {
        $title = "Топ пользователей Голоса | $title_domain";
        $meta_keywords = "Golos, топ, пользователи, юзеры";
        $meta_description = "Страница топа пользователей Голоса";
        $h1 = "Топ пользователей Голоса";
        $description = '<p>Топ по СГ, GBG и GOLOS.</p>';
    } else if (strtoupper($array_url[1]) == 'GBG') {
        $title = "Топ пользователей Голоса по GBG | $title_domain";
        $meta_keywords = "golos, топ, gbg, гбг";
        $meta_description = "Топ пользователей Голоса по GBG.";
        $h1 = "Топ по GBG";
        $description = '<p>Топ 100 пользователей, отсортированных по GBG.</p>';
    } else if (strtoupper($array_url[1]) == 'GOLOS') {
        $title = "Топ пользователей Голоса по GOLOS | $title_domain";
        $meta_keywords = "golos, топ, GOLOS, токен";
        $meta_description = "Топ пользователей Голоса по токену GOLOS.";
        $h1 = "Топ по GOLOS";
        $description = '<p>Топ 100 пользователей, отсортированных по GOLOS.</p>';
    } else if (strtoupper($array_url[1]) == 'GP') {
        $title = "Топ пользователей Голоса по СГ | $title_domain";
        $meta_keywords = "golos, топ, СГ, силаголоса";
        $meta_description = "Топ пользователей Голоса по СГ.";
        $h1 = "Топ по СГ";
        $description = '<p>Топ 100 пользователей, отсортированных по Силе Голоса.</p>';
    }
    $footer_text = "просматривать топ Голоса по токенам";
} // Конец условия для данного сервиса