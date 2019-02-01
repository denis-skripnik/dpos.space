<?php
if (($array_url[0] ?? $array_url[0] ?? "") == 'feed') {
    if (!isset($array_url[1]) && !isset($chain)) {
        $title = "Просмотрщик фида аккаунта блокчейнов Steem, Golos и WhaleShares $title_domain";
        $meta_keywords = "steem, golos, WhaleShares, клиент, аккаунт, фид, лента";
        $meta_description = "Сайт, где вы сможете посмотреть свою ленту.";
        $h1 = "Лента аккаунта";
        $description = "<p>Список постов ваших подписчиков.</p>";
    } else if (!isset($array_url[1]) && !isset($array_url[2])) {
        $title = "Просмотрщик фида аккаунта блокчейнов Steem, Golos и WhaleShares $title_domain";
        $meta_keywords = "steem, golos, WhaleShares, клиент, аккаунт, фид, лента";
        $meta_description = "Сайт, где вы сможете посмотреть свою ленту.";
        $h1 = "Лента аккаунта";
        $description = "<p>Список постов ваших подписчиков.</p>";
    } else if (isset($chain)) {
        $title = "Просмотрщик фида аккаунта $array_url[1] блокчейна " . $chain_name . " $title_domain";
        $meta_keywords = "$chain_name, клиент, аккаунт, профиль";
        $meta_description = "Сайт, где вы сможете посмотреть свою ленту.";
        $description = "<p>Список постов ваших подписчиков.</p>";

        $h1 = "Лента аккаунта $array_url[1]";
    } else if (!isset($chain)) {
        $title = "Просмотрщик фида аккаунта блокчейнов Steem, Golos и WhaleShares $title_domain";
        $meta_keywords = "steem, golos, WhaleShares, клиент, аккаунт, фид, лента";
        $meta_description = "Сайт, где вы сможете посмотреть свою ленту.";
        $h1 = "Лента аккаунта";
        $description = "<p>Список постов ваших подписчиков.</p>";
    }
    $footer_text = "просматривать ленту подписчиков пользователя " . ($chain_name ?? "") . " в удобном виде.";
} // Конец условия для данного сервиса