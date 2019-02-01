<?php
if (($array_url[0] ?? $array_url[0] ?? "") == 'tags') {
    if (!isset($array_url[1]) && !isset($chain)) {
        $title = "Сервис транслитирации и поиска тегов $title_domain";
        $meta_keywords = "steem, golos, WLS, клиент, сайт, теги, тег, подбор";
        $meta_description = "Сайт с возможностью подбора или транслита тегов.";
        $h1 = "Работа с тегами";
        $description = '<p>Выберите сервис:<br />
<a href="https://dpos.space/tags/" target="_blank">транслитиратор тегов</a>, <a href="https://dpos.space/tags/all" target="_blank">Все теги Голоса (Можете использовать и при написании постов в других блокчейнах)</a>.</p>';
    } else if (!isset($array_url[1]) && !isset($array_url[2])) {
        $title = "Сервис транслитирации и поиска тегов $title_domain";
        $meta_keywords = "steem, golos, WLS, клиент, сайт, теги, тег, подбор";
        $meta_description = "Сайт с возможностью подбора или транслита тегов.";
        $h1 = "Работа с тегами";
        $description = '<p>Выберите сервис:<br />
<a href="https://dpos.space/tags/" target="_blank">транслитиратор тегов</a>, <a href="https://dpos.space/tags/all" target="_blank">Все теги Голоса (Можете использовать и при написании постов в других блокчейнах)</a>.</p>';
    } else if ($array_url[1] == 'all') {
        $title = "Все теги Голоса $title_domain";
        $meta_keywords = "Голос, клиент, теги, список";
        $description = "<p>База данных тегов Голоса.</p>
<p>Вы можете использовать эти теги и при написании постов в других блокчейнах.</p>";
        $meta_description = "Список всех тегов блокчейна Golos.";
        $profiles_script = '';

        $h1 = "Список всех тегов";
    }
    $footer_text = "просматривать список тегов " . ($chain_name ?? $chain_name ?? "") . " (Пополняются постепенно)";
} // Конец условия для данного сервиса