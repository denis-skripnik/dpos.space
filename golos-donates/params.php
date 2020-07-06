<?php
if (($array_url[0] ?? $array_url[0] ?? "") == 'golos-donates') {
    if (!isset($array_url[1]) && !isset($chain)) {
        $title = "Донаты Голоса | $title_domain";
        $meta_keywords = "golos, донаты, donates";
        $meta_description = "Страница донатов Голоса.";
        $h1 = "Golos donates";
        $description = '<p>Топ донатеров и постов. Сортировка по GOLOS или по GBG.</p>';
    } else if (!isset($array_url[1]) && !isset($array_url[2])) {
        $title = "Донаты Голоса | $title_domain";
        $meta_keywords = "golos, донаты, donates";
        $meta_description = "Страница донатов Голоса.";
        $h1 = "Golos donates";
        $description = '<p>Топ донатеров и постов. Сортировка по GOLOS или по GBG.</p>';
    } else if ($array_url[1] == 'posts') {
        $title = "Посты-лидеры по количеству донатов | $title_domain";
        $meta_keywords = "golos, донаты, donates, посты";
        $meta_description = "Здесь вы найдёте топ постов, получивших наибольшее количество донатов.";
        $h1 = "Golos donates";
        $description = '<p>Здесь вы найдёте топ постов, получивших наибольшее количество донатов.</p>';
        $profiles_script = '';
    } else if ($array_url[1] == 'posts' && isset($array_url[2])) {
        $title = "Посты-лидеры по количеству донатов | $title_domain";
        $meta_keywords = "golos, донаты, donates, посты";
        $meta_description = "Здесь вы найдёте топ постов, получивших наибольшее количество донатов.";
        $h1 = "Golos donates";
        $description = '<p>Здесь вы найдёте топ постов, получивших наибольшее количество донатов.</p>';
        $profiles_script = '';
    } else if ($array_url[1] == 'comments') {
        $title = "Комментарии-лидеры по количеству донатов | $title_domain";
        $meta_keywords = "golos, донаты, donates, комментарии";
        $meta_description = "Здесь вы найдёте топ комментариев, получивших наибольшее количество донатов.";
        $h1 = "Golos donates";
        $description = '<p>Здесь вы найдёте топ комментариев, получивших наибольшее количество донатов.</p>';
        $profiles_script = '';
    } else if ($array_url[1] == 'comments' && isset($array_url[2])) {
        $title = "Комментарии-лидеры по количеству донатов | $title_domain";
        $meta_keywords = "golos, донаты, donates, комментарии";
        $meta_description = "Здесь вы найдёте топ комментариев, получивших наибольшее количество донатов.";
        $h1 = "Golos donates";
        $description = '<p>Здесь вы найдёте топ комментариев, получивших наибольшее количество донатов.</p>';
        $profiles_script = '';
    } else if (isset($array_url[1]) && $array_url[1] !== 'posts' && $array_url[1] !== 'posts') {
        $title = "Донаты Голоса | $title_domain";
        $meta_keywords = "golos, донаты, donates";
        $meta_description = "Страница донатов Голоса.";
        $h1 = "Golos donates";
        $description = '<p>Топ донатеров и постов. Сортировка по GOLOS или по GBG.</p>';
    }
    $footer_text = "просматривать топ донатеров или постов, получивших донаты";
} // Конец условия для данного сервиса