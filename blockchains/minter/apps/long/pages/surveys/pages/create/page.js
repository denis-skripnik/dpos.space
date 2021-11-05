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

   async function submitSurvey(q) {
    if (q !== '' && answers.length > 0) {
        let value = 100;
        var c = window.confirm('Вы действительно хотите создать опрос? Операция платная: стоит ' + value + ' LONG');
        if (c === true) {
let variants = answers.join(' -> ');
            let memo = `ls -> ${q} -> ${variants}`;
            let fee = await send('Mx01029d73e128e2f53ff1fcc2d52a423283ad9439', value, 'LONG', memo, 'fee', 'LONG');
let balances = await getBalance(sender.address);
let bip_balance = 0;
let long_balance = 0;
for (let balance of balances) {
    if (balance.coin === 'LONG') long_balance = balance.amount;
    if (balance.coin === 'BIP') bip_balance = balance.amount;
}
let gascoin = 'LONG';
if (long_balance < 100 + fee.fee && bip_balance >= fee.bip_fee) {
gascoin = 'BIP';
} else if (long_balance < 100 || long_balance < 100 + fee.fee && bip_balance < fee.bip_fee) {
    gascoin = '';
}

if (gascoin !== '') {
    await send('Mx01029d73e128e2f53ff1fcc2d52a423283ad9439', value, 'LONG', memo, '', gascoin);
} else {
    window.alert('Не хватает суммы для оплаты комиссии и / или баланса для создания опроса.');
}
        }
    } else {
window.alert('Нет добавленных вариантов ответа.');
}
}
