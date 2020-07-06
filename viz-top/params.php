<?php
if (($array_url[0] ?? $array_url[0] ?? "") == 'viz-top') {
    if (!isset($array_url[1]) && !isset($chain)) {
        $title = "Топ пользователей Viz | $title_domain";
        $meta_keywords = "Viz, топ, пользователи, юзеры";
        $meta_description = "Страница топа пользователей Viz";
        $h1 = "Топ пользователей Viz";
        $description = '<p>Топ по Соц. капиталу, Viz и другим показателям.</p>';
    } else if (!isset($array_url[1]) && !isset($array_url[2])) {
        $title = "Топ пользователей Viz | $title_domain";
        $meta_keywords = "Viz, топ, пользователи, юзеры";
        $meta_description = "Страница топа пользователей Viz";
        $h1 = "Топ пользователей Viz";
        $description = '<p>Топ по Соц. капиталу, Viz и другим показателям.</p>';
    } else if (isset($array_url[1])) {
        $tokens = ['viz' => 'VIZ', 'shares' => 'соц. капиталу', 'delegated_shares' => 'делегированному другим соц. капиталу', 'received_shares' => 'полученному делегированием соц. капиталу', 'effective_shares' => 'эффективному соц. капиталу'];
        $title_text = $tokens[mb_strtolower($array_url[1])];
        $title = "Топ пользователей Viz по $title_text | $title_domain";
        $meta_keywords = "Viz, топ, ".$array_url[1].", $title_text";
        $meta_description = "Топ пользователей Viz по $title_text.";
        $h1 = "Топ по $title_text";
        $description = '<p>Топ 100 пользователей, отсортированных по '.$title_text.'.</p>';
    }
    $footer_text = "просматривать топ Viz по токенам";
} // Конец условия для данного сервиса