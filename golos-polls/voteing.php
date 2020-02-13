<script>
function submitVoteing(permlink, sender, answer) {
    let memo_array = {};
memo_array.contractName = "golos-votes";
memo_array.contractAction = "voteing";
memo_array.contractPayload = {};
memo_array.contractPayload.votePermlink = permlink;
memo_array.contractPayload.answerId = answer;
let memo = JSON.stringify(memo_array);
    let data_url = [];
    data_url.push(["custom_json",{"required_auths":[],          "required_posting_auths": [sender],"id":"golos-votes","json":memo}]);
    let str_data_url = JSON.stringify(data_url);
        if (sender && answer) {
        window.open("https://gropox.github.io/sign/?user=" + sender + "&tr=" + str_data_url);
} else if (!sender) {
window.alert('Вы не ввели логин');
} else if (!answer) {
    window.alert('Вы не добавили ответы');
}
}
</script>
<?php
echo '<main class="content">
<p><span align="left">Голосование</span> <span align="center"><a href="https://dpos.space/golos-polls/results/'.$array_url[2].'">Предварительные или окончательные результаты</a></span> <span align="right"><a href="https://dpos.space/golos-polls/list">Список опросов</a></span></p>';$html = file_get_contents('http://138.201.91.11:3200/golos-votes?type=voteing&permlink='.$array_url[2]);
if ($array_url[2] && $html) {
$table = json_decode($html, true);
$answers = $table['answers'];
if ($answers && $table['end_date'] > gmmktime()) {
    $d = new DateTime();
    $d->setTimestamp($table['end_date']);
    
    // или createFromFormat с форматом U
    $d = DateTime::createFromFormat('U', $table['end_date']);
    echo '<hr>
    <h2>Вопрос: '.$table['question'].'</h2>
    <h3>Дата и время завершения: '.$d->format('d.m.Y H:i:s').' GMT</h3>
    <form>
<p><label for="sender">Голосующий:</label></p>
<p><input type="text" name="sender" value="" placeholder="логин голосующего"></p>
<hr>
<p><label for="answers">Выберите вариант ответа:</label></p>
<hr>';
foreach ($answers as $num => $answer) {
    echo '<p><input type="radio" name="answers" id="voteing" value="'.$num.'" placeholder="'.$answer.'"> '.$answer.'</p>';
}
echo '</p>
<hr>
<p><button type="button" onclick="submitVoteing(`'.$array_url[2].'`, this.form.sender.value, this.form.answers.value)">Голосовать</button></p>
</form>';
} else if ($table['end_date'] <= gmmktime()) {
    echo '<p>Опрос закончен.</p>';
}
} else {
echo '<p>Такого опроса нет.</p>';
}
echo '</main>';
?>