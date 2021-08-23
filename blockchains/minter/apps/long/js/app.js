$(document).ready(function() {

    $('#max_lp').click(function() {
    let amount = $('#max_lp').html();
    $('[name=lp_tokens]').val(amount);
    $('[name=calc_percent]').val(100);
    $('#lp_percent').html(100);
    let my_share = $('[name=my_share]').val();
let get_amount = parseFloat($('#all_get_amount').html());
let result = get_amount - (get_amount * (my_share / 100));
$('#send_amount').html(result);
}); // end max LP click.

$('[name=lp_tokens]').change(function() {
    let amount = parseFloat($('[name=lp_tokens]').val());
let max = parseFloat($('#max_lp').html());
let percent = amount / max * 100;
$('[name=calc_percent]').val(percent);
$('#lp_percent').html(percent);
let my_share = $('[name=my_share]').val();
let get_amount = parseFloat($('#all_get_amount').html());
get_amount *= percent / 100;
let result = get_amount - (get_amount * (my_share / 100));
$('#send_amount').html(result);
}); // end change LP_tokens.

$('[name=calc_percent]').change(function() {
    let percent = parseFloat($('[name=calc_percent]').val());
let max = parseFloat($('#max_lp').html());
let amount = max * (percent / 100)
$('[name=lp_tokens]').val(amount);
let my_share = $('[name=my_share]').val();
let get_amount = parseFloat($('#all_get_amount').html());
get_amount *= percent / 100;
let result = get_amount - (get_amount * (my_share / 100));
$('#lp_percent').html(percent);
$('#send_amount').html(result);
}); // end change

$('[name=my_share]').change(function() {
    let percent = parseFloat($('[name=calc_percent]').val());
let my_share = $('[name=my_share]').val();
let get_amount = parseFloat($('#all_get_amount').html());
get_amount *= percent / 100;
let result = get_amount - (get_amount * (my_share / 100));
$('#self_percent').html(my_share);
$('#send_amount').html(result);
}); // end change my_share

let friends = JSON.parse($('#json_friends').html());
let fcount = 0;
for (let el in friends) {
    $('[name=friends_templates]').append(`<option value="${el}">${el}</option>`);
    fcount += friends[el].lp_tokens;
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
let max = parseFloat($('#max_lp').html());
let percent = fd.lp_tokens / max * 100;
$('[name=calc_percent]').val(percent);
$('#lp_percent').html(percent);
let get_amount = parseFloat($('#all_get_amount').html());
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
        let max = parseFloat($('#max_lp').html());
        let friend = $('[name=friends_templates]').val();
        let send_amount = parseFloat($('#send_amount').html());
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
        let amount = parseFloat($('[name=lp_tokens]').val());
        let my_share = parseFloat($('[name=my_share]').val());
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
});