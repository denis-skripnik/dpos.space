async function submitVoteing(id, answer) {
if (!answer) {
    window.alert('Вы не добавили ответы');
} else {
    let variant = parseInt(answer) + 1;
    var q = window.confirm('Вы действительно хотите проголосовать за вариант №' + variant + '?');
    if (q === true) {
let memo = `ls ${id} ${answer}`;
let fee = await send('Mx01029d73e128e2f53ff1fcc2d52a423283ad9439', 0, 'BIP', memo, 'fee', 'BIP');
if (typeof sender.address !== 'undefined') {
    let balances = await getBalance(sender.address);
    let bip_balance = 0;
    for (let balance of balances) {
        if (balance.coin === 'BIP') bip_balance = balance.amount;
    }
    let gascoin = '';
    if (bip_balance >= fee.bip_fee) {
    gascoin = 'BIP';
    }
    
    if (gascoin !== '') {
        await send('Mx01029d73e128e2f53ff1fcc2d52a423283ad9439', 0, 'BIP', memo, '', gascoin);
    } else {
        window.alert('Не хватает суммы для оплаты комиссии');
    }
        } else {
            await send('Mx01029d73e128e2f53ff1fcc2d52a423283ad9439', 0, 'BIP', memo, '', 'BIP');
}
}
}
}
