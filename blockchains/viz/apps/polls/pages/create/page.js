$(document).ready(function() {
    if (active_key) {
        var objSel = document.getElementById("clients");
    console.log(JSON.stringify(objSel));
        //Создаем новый объект Option и заносим его в коллекцию options
        objSel.options[0] = new Option("Dpos.space", "dpos.space", false, true);
    }
   
});

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

function sendData(operations) {
    var q = window.confirm('Вы действительно хотите создать опрос? Операция платная: стоит 1 VIZ');
    if (q === true) {
        viz.broadcast.send({extensions: [], operations}, [active_key], function(err, res) {
if (!err) {
    window.alert('Опрос успешно создан.');
} else {
    window.alert('Ошибка: ' + JSON.stringify(err));
}
    });
    }
}

   function submitPoll(sender, q, end_date, consider, clients) {
    sender = sender.toLowerCase();
    if (end_date) {
    let endDate = parseInt(new Date(end_date).getTime()/1000);
    let memo_array = {};
memo_array.contractName = "viz-votes";
memo_array.contractAction = "createVote";
memo_array.contractPayload = {};
memo_array.contractPayload.question = q;
memo_array.contractPayload.answers = answers;
memo_array.contractPayload.end_date = endDate;
memo_array.contractPayload.consider = parseFloat(consider);
let memo = JSON.stringify(memo_array);
    let data_url = [];
    data_url.push(["transfer",{"from":sender,"to":"committee","amount":"1.000 VIZ","memo":memo}]);
        let str_data_url = JSON.stringify(data_url);
    if (answers.length > 0) {
    if (clients === "sign") {
window.open("https://viz.dpos.space/viz-sign/?user=" + sender + "&tr=" + str_data_url);
    } else if (clients === 'dpos.space') {
            if(current_user.type && current_user.type === 'vizonator') {
                var q = window.confirm('Вы действительно хотите создать опрос? Операция платная: стоит 1 VIZ');
                if (q === true) {
                        sendToVizonator('transfer', {"to":"committee","amount":"1.000 VIZ","memo":memo})
              return;
              }
            }
              sendData(data_url);
    }
} else {
window.alert('Нет добавленных вариантов ответа.');
}
} else {
window.alert('Вы не указали дату и время окончания опроса.');
}
}
