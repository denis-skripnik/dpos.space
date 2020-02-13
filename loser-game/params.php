<?php
if (($array_url[0] ?? $array_url[0] ?? "") == 'loser-game') {
if(!isset($array_url[1] ) ){
        $title = "Loser-game - игра в блокчейнах Steem, Golos и Viz $title_domain";
        $meta_keywords = "steem, golos, Viz, клиент, loser, loser-game, игра";
        $meta_description = "Страницы игры Loser-game.";
        $h1 = "Loser-game";
        $description = "<p>Активные и завершённые раунды.</p>";
} else if( isset($array_url[1] ) ){
        $title = "Loser-game в $chain_name $title_domain";
        $meta_keywords = "steem, golos, Viz, loser, loser-game, игра";
        $meta_description = "Страницы игры Loser-game.";
        $h1 = "Loser-game";
        $description = "<p>Активные и завершённые раунды.</p>";
}
$footer_text = "где можно играть в Loser-game для " . ($chain_name ?? $chain_name ?? "");
} // Конец условия для данного сервиса