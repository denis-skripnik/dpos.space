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
    } else if (isset($array_url[1])) {
        $tokens = ['golos' => 'GOLOS', 'gbg' => 'GBG', 'gp' => 'СГ', 'delegated_gp' => 'делегированной другим СГ', 'received_gp' => 'полученной делегированием СГ', 'effective_gp' => 'эффективной СГ'];
        $title_text = $tokens[mb_strtolower($array_url[1])];
        $title = "Топ пользователей Голоса по $title_text | $title_domain";
        $meta_keywords = "golos, топ, ".$array_url[1].", $title_text";
        $meta_description = "Топ пользователей Голоса по $title_text.";
        $h1 = "Топ по $title_text";
        $description = '<p>Топ 100 пользователей, отсортированных по '.$title_text.'.</p>';
    }
    $footer_text = "просматривать топ Голоса по токенам";
} // Конец условия для данного сервиса