function witnesses(from, witness_votes) {
    hive.api.getWitnessesByVote(from, 100, function(err, res) {
          if (!err && res.length > 1) {
   var end_witness = '';
   for (let i = 0; i <= res.length; i++) {
if (from === '') {
    let witness = res[i];
    let status = '';
if (witness.signing_key === "HIVE1111111111111111111111111111111114T1Anm") {
    status = "неактивный";
} else {
    status = "активный";
}
let url_text = 'url';
if (witness.url.indexOf('hiveit.com') > -1 || witness.url.indexOf('hive.blog') > -1) {
    url_text = 'пост';
} else {
    url_text = 'сайт';
}
if (witness_votes.indexOf(witness.owner) > -1) {
$('#witnesses_list').append(`<li><label><input type="checkbox" checked name="witnesses" value="${witness.owner}">${status} делегат <a href="https://dpos.space/hive/profiles/${witness.owner}" target="_blank">${witness.owner}</a>, <a href="${witness.url}" target="_blank">${url_text}</a>, <a href="https://dpos.space/hive/profiles/${witness.owner}/witness" target="_blank">Параметры</a></label></li>`);
} else {
    $('#witnesses_list').append(`<li><label><input type="checkbox" name="witnesses" value="${witness.owner}">${status} делегат <a href="https://dpos.space/hive/profiles/${witness.owner}" target="_blank">${witness.owner}</a>, <a href="${witness.url}" target="_blank">${url_text}</a>, <a href="https://dpos.space/hive/profiles/${witness.owner}/witness" target="_blank">Параметры</a></label></li>`);
}
end_witness = witness.owner;
} else if (from !== '' && i > 0) {
    let witness = res[i];
    let status = '';
if (witness.signing_key === "HIVE1111111111111111111111111111111114T1Anm") {
    status = "неактивный";
} else {
    status = "активный";
}
let url_text = 'url';
if (witness.url.indexOf('hiveit.com') > -1 || witness.url.indexOf('hive.blog') > -1) {
    url_text = 'пост';
} else {
    url_text = 'сайт';
}
$('#witnesses_list').append(`<li><label><input type="checkbox" name="witnesses" value="${witness.owner}">${status} делегат <a href="https://dpos.space/hive/profiles/${witness.owner}" target="_blank">${witness.owner}</a>, <a href="${witness.url}" target="_blank">${url_text}</a></label></li>`);
end_witness = witness.owner;
}
}
witnesses(end_witness)
}
});
}

function main() {
hive.api.getAccounts([hive_login], function(err, res) {
    if (res[0].proxy !== '') {
        $('#proxy').html('<p>Аккаунт <a href="https://dpos.space/hive/profiles/' + hive_login + '" target="_blank">' + hive_login + '</a> установил в качестве прокси <a href="https://dpos.space/hive/profiles/' + res[0].proxy + '" target="_blank">' + res[0].proxy + '</a></p>');
    $('input[name=proxy_login]').val(res[0].proxy);
$('#delete_proxy').css('display', 'block');
} else {
    $('#delete_proxy').css('display', 'none');
}
    let witness_votes = res[0]['witness_votes'];
    $('#count_witnesses').html(30 - witness_votes.length);
    witnesses('', witness_votes);
});
}
main();