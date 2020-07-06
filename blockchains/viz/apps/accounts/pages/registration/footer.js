function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
        vars[key] = value;
    });
    return vars;
}

function inviteRegPage(new_account_name, invite_secret, new_account_key, private_key) {
	viz.broadcast.inviteRegistration('5KcfoRuDfkhrLCxVcE9x51J6KN9aM9fpb78tLrvvFckxVV6FyFW', 'invite', new_account_name, invite_secret, new_account_key, function(err, result) {
		if (!err) {
		console.log('inviteRegistration', result);
window.alert('Регистрация прошла успешно.\nВаш логин: '+ new_account_name + ',\nВаш ключ: ' + private_key + '\n\nДобро пожаловать! И не забудьте сохранить ваш ключ, так как его нельзя восстановить.')
	}
	else console.error(err);
  	});
}


var invite_code = getUrlVars()['invite'];
if (invite_code) {
document.getElementById('invite_secret').value = invite_code;
$('#invite_secret').prop('readonly', true);
}

function new_private_gen() {
	$('#new_account_key').val(pass_gen());
}

	function send_reg_data() {
var new_account_key_id = $("#new_account_key").val();
		var resultWifToPublic = viz.auth.wifToPublic(new_account_key_id);
	console.log('wifToPublic', resultWifToPublic);
		inviteRegPage(document.getElementById('new_account_name').value, document.getElementById('invite_secret').value, resultWifToPublic, new_account_key_id);
}

//цепляем событие на onclick кнопки
var button = document.getElementById('new_private_copy');
button.addEventListener('click', function () {
  //нашли наш контейнер
  var ta = document.querySelector('#new_account_key');
    ta.focus();
    ta.setSelectionRange(0, ta.value.length);
 
  try { 
    document.execCommand('copy'); 
  } catch(err) { 
    console.log('Can`t copy, boss'); 
  } 
  //очистим выделение текста, чтобы пользователь не парился
  window.getSelection().removeAllRanges();
});

$('input[name=newAccountName]')  .change(function () {
  viz.api.getAccounts([$('input[name=newAccountName]').val().trim()], function(err, res) {
    if (!err && res.length !== 0) {
      $('#check_login').empty();
      $('#check_login').html('<strong><span style="color: red;">Аккаунт существует. Введите иной логин.</span></strong>');
    } else {
      $('#check_login').empty();
      $('#check_login').html('Аккаунт свободен.');
    }
  });
});