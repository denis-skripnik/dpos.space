<?php
echo '<main class="content"><p><span align="left">Список опросов</span> <span align="right"><a href="https://dpos.space/golos-polls/create">Создание нового опроса</a></span></p>';
$html = file_get_contents('http://62.1138.201.91.11:3200/golos-votes?type=list');
$table = json_decode($html, true);
echo '<ul>';
foreach ($table as $poll) {
    echo '<li><a href="https://dpos.space/golos-polls/voteing/'.$poll['permlink'].'" target="_blank">'.$poll['question'].'</a></li>
';
}
echo '</ul>
</main>';
?>