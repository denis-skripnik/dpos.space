<script>
var answers = [];
   function updateText() {
let result = '';
for (let answer of answers) {
result += `<li>${answer}</li>`;
}
       document.getElementById('out').innerHTML = '<p>Итоговый список:</p><ol>' + result + '</ol>';
    }
   
   function add() {
    var a = document.getElementById('answer').value;
    if (!a) {
            return alert('Не ввели вариант ответа');
    }
if (answers.indexOf(a) > -1) {
    return alert('Такой вариант ответа уже есть.');
}
answers.push(a);

           updateText()
          }
   
   updateText();
function submitPoll(sender, q, end_date, consider, clients) {
    if (end_date) {
    let endDate = parseInt(new Date(end_date).getTime()/1000);
    let memo_array = {};
memo_array.contractName = "golos-votes";
memo_array.contractAction = "createVote";
memo_array.contractPayload = {};
memo_array.contractPayload.question = q;
memo_array.contractPayload.answers = answers;
memo_array.contractPayload.end_date = endDate;
memo_array.contractPayload.consider = parseFloat(consider);
let memo = JSON.stringify(memo_array);
    let data_url = [];
    data_url.push(["transfer",{"from":sender,"to":"null","amount":"20.000 GBG","memo":memo}]);
    let str_data_url = JSON.stringify(data_url);
    if (answers.length > 0) {
    if (clients === "sign") {
window.open("https://gropox.github.io/sign/?user=" + sender + "&tr=" + str_data_url);
    } else if (clients === "golos_id") {
        // window.open("https://golos.id/@" + sender + "/transfers?to=null&amount=20.000&token=gbg&memo=" + memo);
window.alert('Пока что golos.id выбирать нельзя. Пожалуйста, создайте опрос при помощи Писаря.');
    }
} else {
window.alert('Нет добавленных вариантов ответа.');
}
} else {
window.alert('Вы не указали дату и время окончания опроса.');
}
}
</script>
<main class="content"><p><span align="left">Создание опроса</span> <span align="right"><a href="https://dpos.space/golos-polls/list">Список</a></span></p>
<form>
<p><label for="login">Логин создателя опроса:</label>
<input type="text" name="login" id="sender" value="" placeholder="Введите логин создателя опроса"></p>
<p><label for="q">Вопрос:</label>
    <input type="text" name="q" id="question" value="" placeholder="Вопрос"></p>
    <p><lable for="a">Варианты ответа:</label>
<input name="a" id="answer" placeholder="Введите ответ" type="text" ></p>
    <p><button type="button" onclick="add()">Добавить</button></p>
    <div id="out"></div>
<p><label for="end_date">Дата и время окончания опроса:</label>
<input type="datetime-local" name="end_date" id="datetime" placeholder="Дата и времяокончания опроса"></p>
<p><label for="consider">Учитывать при расчёте результатов СГ: </label>
<select name="consider" id="vote_consider" placeholder="Учитывать при расчёте результатов СГ">
    <option value="0">Личную</option>
    <option value="1">Личную + прокси</option>
    <option value="2">Как при апвотах</option>
</select></p>
<p><label for="service">При помощи чего создавать опрос: </label>
<select name="service" id="clients" placeholder="При помощи чего создать опрос">
<option value="sign">Писарь</option>
    <option value="golos_id">golos.id</option>
</select></p>
<p><button type="button" onclick="submitPoll(this.form.login.value, this.form.q.value, this.form.end_date.value, this.form.consider.value, this.form.service.value)">Создать</button></p>
</form>
</main>