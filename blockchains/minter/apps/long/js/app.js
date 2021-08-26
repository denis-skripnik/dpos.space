async function getPrices() {
    let get_price = (await axios.get('/swap_pool/0/2782')).data;
    let price = parseFloat(get_price.amount0) / parseFloat(get_price.amount1);
    let res_bip_prices = (await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bip&vs_currencies=usd,rub')).data;
    let usd_bip_price = res_bip_prices['bip']['usd'];
    let rub_bip_price = res_bip_prices['bip']['rub'];
    let usd_price = price * usd_bip_price;
        let rub_price = price * rub_bip_price;
    $('#prices').html(`Курс 1 LONG = <span id="current_price">${price.toFixed(5)}</span> BIP, $ ${usd_price.toFixed(5)}, ${rub_price.toFixed(5)} Руб.`);
    const date = new Date().toLocaleString();
    if (document.getElementById('page_date')) $('#page_date').html(date);
    return {price, usd_bip_price, rub_bip_price};
}

$(document).ready(function() {
    const date = new Date().toLocaleString();
    if (document.getElementById('page_date')) $('#page_date').html(date);
    
    $('#max_lp').click(function() {
    let amount = $('#max_lp').html();
    $('[name=lp_tokens]').val(amount);
    $('[name=calc_percent]').val(100);
    $('#lp_percent').html(100);
    let my_share = parseFloat($('[name=my_share]').val().replace(',', '.'));
let get_amount = parseFloat($('#all_get_amount').html().replace(',', '.'));
let result = get_amount - (get_amount * (my_share / 100));
$('#send_amount').html(result);
}); // end max LP click.

$('[name=lp_tokens]').change(function() {
    let amount = parseFloat($('[name=lp_tokens]').val().replace(',', '.'));
let max = parseFloat($('#max_lp').html().replace(',', '.'));
let percent = amount / max * 100;
$('[name=calc_percent]').val(percent);
$('#lp_percent').html(percent);
let my_share = parseFloat($('[name=my_share]').val().replace(',', '.'));
let get_amount = parseFloat($('#all_get_amount').html().replace(',', '.'));
get_amount *= percent / 100;
let result = get_amount - (get_amount * (my_share / 100));
$('#send_amount').html(result);
}); // end change LP_tokens.

$('[name=calc_percent]').change(function() {
    let percent = parseFloat($('[name=calc_percent]').val().replace(',', '.'));
let max = parseFloat($('#max_lp').html().replace(',', '.'));
let amount = max * (percent / 100)
$('[name=lp_tokens]').val(amount);
let my_share = parseFloat($('[name=my_share]').val().replace(',', '.'));
let get_amount = parseFloat($('#all_get_amount').html().replace(',', '.'));
get_amount *= percent / 100;
let result = get_amount - (get_amount * (my_share / 100));
$('#lp_percent').html(percent);
$('#send_amount').html(result);
}); // end change

$('[name=my_share]').change(function() {
    let percent = parseFloat($('[name=calc_percent]').val());
let my_share = $('[name=my_share]').val();
let get_amount = parseFloat($('#all_get_amount').html().replace(',', '.'));
get_amount *= percent / 100;
let result = get_amount - (get_amount * (my_share / 100));
$('#self_percent').html(my_share);
$('#send_amount').html(result);
}); // end change my_share

if (document.querySelector('[name=friends_templates]')) {
    let friends = JSON.parse($('#json_friends').html());
    let fcount = 0;
    if (Object.keys(friends).length > 0) {
        for (let el in friends) {
            $('[name=friends_templates]').append(`<option value="${el}">${el}</option>`);
            fcount += friends[el].lp_tokens;
        }
    }
    $('[name=friends_templates]').change(function() {
    let friend = $('[name=friends_templates]').val();
    if(friend !== '') {
        let fd = friends[friend];
    if (sender.address === page_address) {
        $('#delete_friend').css('display', 'inline');
        $('#delete_friend').html(`(<input type="button" value="Удалить" id="delete_friend">)`);
    }
        $('[name=lp_tokens]').val(fd.lp_tokens);
    $('[name=my_share]').val(fd.my_share);
    $('#self_percent').html(fd.my_share);
    let max = parseFloat($('#max_lp').html().replace(',', '.'));
    let percent = fd.lp_tokens / max * 100;
    $('[name=calc_percent]').val(percent);
    $('#lp_percent').html(percent);
    let get_amount = parseFloat($('#all_get_amount').html().replace(',', '.'));
    get_amount *= percent / 100;
    let result = get_amount - (get_amount * (fd.my_share / 100));
    $('#send_amount').html(result);
    } else {
        $('#delete_friend').css('display', 'none');
        $('#delete_friend').html(``);
        $('[name=lp_tokens]').val('');
    $('[name=my_share]').val(0);
    $('#self_percent').html(0);
    $('[name=calc_percent]').val(0);
    $('#lp_percent').html(0);
    $('#send_amount').html(0);
    }
    });
    
    var page_address = document.location.pathname.split('/')[4];
    if (sender.address === page_address) {
        $('#save_friend').css('display', 'inline');
        
        $('#delete_friend').click(function() {
            let friend = $('[name=friends_templates]').val();
            var q = window.confirm('Вы действительно хотите удалить?');
            if (q == false) return;
            if(friend !== '') {
                delete friends[friend];
                $('[name=friends_templates] :selected').remove(); // будет удален Новосибирск
                fcount -= friends[friend].lp_tokens;
                $('#delete_friend').css('display', 'none');
                $('#delete_friend').html(``);
                $('[name=lp_tokens]').val('');
        $('[name=my_share]').val(0);
        $('#self_percent').html(0);
        $('[name=calc_percent]').val(0);
        $('#lp_percent').html(0);
        $('#send_amount').html(0);
            }
        });
        
        $('#save_friend').click(async function() {
            if (Object.keys(friends).length === 5) {
                window.alert('Вы не можете добавить больше пяти друзей.');
                return;
            }
            let max = parseFloat($('#max_lp').html().replace(',', '.'));
            let friend = $('[name=friends_templates]').val();
            let send_amount = parseFloat($('#send_amount').html().replace(',', '.'));
            if (friend === '' && send_amount && send_amount !== '' && send_amount > 0) {
                        var name = window.prompt('Введите имя, по которому идентифицировать будете друга');
                if (!name || typeof name == 'undefined' || name === '') return;
            } else {
                if (Object.keys(friends).length === 0) friends = {};
            if (friend && friend !== '') {
                name = friend;
            }
            }
        var q = window.confirm('Отправить?');
        if (q == true) {
            let amount = parseFloat($('[name=lp_tokens]').val().replace(',', '.'));
            let my_share = parseFloat($('[name=my_share]').val().replace(',', '.'));
            let data = [];
        data[0] = "friends";
        data[1] = friends;
        if (typeof name !== 'undefined' || name && name !== '') {
            data[1][name] = {lp_tokens: amount, my_share};
            $('[name=friends_templates]').append(`<option value="${name}">${name}</option>`);
        friends[name] = {lp_tokens: amount, my_share};
        fcount += amount;
        if (fcount > max) {
            window.alert('Общая сумма LP-токенов больше максимума.');
        return;
        }
        }
        await send('Mx01029d73e128e2f53ff1fcc2d52a423283ad9439', 0, 0, JSON.stringify(data), 0);
        }
        }); // end click save friend.
    
    }
} // end selector.

// profit calc.
$('[name=long_amount]').change(async function() {
   let {price, usd_bip_price, rub_bip_price} = await getPrices();
    let long_amount = parseFloat($('[name=long_amount]').val().replace(',', '.'));
    let tec_long_amount = long_amount * (10 ** 18);
    tec_long_amount = BigInt(tec_long_amount);
    let pool_bip_amount = long_amount * price;
    $('#bip_add_amount').html(pool_bip_amount.toFixed(5));
    let liquidity = Math.sqrt(long_amount * pool_bip_amount);
try {
    let get_bip_amount = (await axios.get(`https://explorer-api.minter.network/api/v2/pools/coins/LONG/BIP/route?amount=${tec_long_amount}&type=input`)).data.amount_out;
if (get_bip_amount) {
    let usd_adding_liquidity = ((get_bip_amount * 2) * usd_bip_price).toFixed(5);
    let rub_adding_liquidity = ((get_bip_amount * 2) * rub_bip_price).toFixed(5);
    $('#adding_liquidity').html(liquidity.toFixed(5) + `, в BIP: ${(get_bip_amount * 2).toFixed(5)}, в $: ${usd_adding_liquidity}, в руб.: ${rub_adding_liquidity}`);
} else {
    $('#adding_liquidity').html(liquidity.toFixed(5));    
}
} catch(e) {
    $('#adding_liquidity').html(liquidity.toFixed(5));
    window.alert('Explorer недоступен. Не можем рассчитать курс покупки.');
    console.error(e);
}
    let invest_days = parseFloat($('[name=invest_days_calc]').val().replace(',', '.'));
    let percent = parseFloat($("#now_percent").text().replace(',', '.'));
    let farming_share = liquidity * (percent / 100);
    let k = 1 + (invest_days / 100);
    farming_share *= k;
    let value = parseFloat(farming_share.toFixed(18));
    $('#result_profit').html(value.toFixed(5));
    });

    $('[name=invest_days_calc]').change(async function() {
        let {price, usd_bip_price, rub_bip_price} = await getPrices();
        let long_amount = parseFloat($('[name=long_amount]').val().replace(',', '.'));
        let tec_long_amount = long_amount * (10 ** 18);
        tec_long_amount = BigInt(tec_long_amount);
        let pool_bip_amount = long_amount * price;
        $('#bip_add_amount').html(pool_bip_amount.toFixed(5));
        let liquidity = Math.sqrt(long_amount * pool_bip_amount);
        try {
        let get_bip_amount = (await axios.get(`https://explorer-api.minter.network/api/v2/pools/coins/LONG/BIP/route?amount=${tec_long_amount}&type=input`)).data.amount_out;
    if (get_bip_amount) {
        let usd_adding_liquidity = ((get_bip_amount * 2) * usd_bip_price).toFixed(5);
        let rub_adding_liquidity = ((get_bip_amount * 2) * rub_bip_price).toFixed(5);
        $('#adding_liquidity').html(liquidity.toFixed(5) + `, в BIP: ${(get_bip_amount * 2).toFixed(5)}, в $: ${usd_adding_liquidity}, в руб.: ${rub_adding_liquidity}`);
    } else {
        $('#adding_liquidity').html(liquidity.toFixed(5));    
    }
    } catch(e) {
        $('#adding_liquidity').html(liquidity.toFixed(5));
        window.alert('Explorer недоступен. Не можем рассчитать курс покупки.');
        console.error(e);
    }
        let invest_days = parseFloat($('[name=invest_days_calc]').val().replace(',', '.'));
        let percent = parseFloat($("#now_percent").text().replace(',', '.'));
        let farming_share = liquidity * (percent / 100);
        let k = 1 + (invest_days / 100);
        farming_share *= k;
        let value = parseFloat(farming_share.toFixed(18));
        $('#result_profit').html(value.toFixed(5));
        });
// end profit calc.
});