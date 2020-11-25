function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
        vars[key] = value;
    });
    return vars;
}

var invite_code = getUrlVars()['invite'];
if (invite_code) {
document.getElementById('invite_secret').value = invite_code;
$('#invite_secret').prop('readonly', true);
}

function download(filename,text) {
  var link = document.createElement('a');
  link.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  link.setAttribute('download', filename);
  if (document.createEvent) {
      var event = document.createEvent('MouseEvents');
      event.initEvent('click', true, true);
      link.dispatchEvent(event);
  }
  else {
      link.click();
  }
}

function send_reg_data(){
  let invite_secret = $('#invite_secret').val();
  let account_login = $('#new_account_name').val();
  let auth_types=['posting','active','owner','memo'];
  var keys=golos.auth.getPrivateKeys(account_login,pass_gen(100),auth_types);
  let owner = {
      'weight_threshold': 1,
      'account_auths': [],
      'key_auths': [
          [keys.ownerPubkey, 1]
      ]
  };
  let active = {
      'weight_threshold': 1,
      'account_auths': [],
      'key_auths': [
          [keys.activePubkey, 1]
      ]
  };
  let posting = {
      "weight_threshold": 1,
      "account_auths": [],
      "key_auths": [
          [keys.postingPubkey, 1]
      ]
  };
  let memo_key=keys.memoPubkey;
  let json_metadata='';
  golos.api.getAccounts([account_login],function(err,response){
                      if(!err && response.length !== 0){
                          $('#account_create_error').css('display', 'block');
                          $('#account_create_error').html(`<p><strong><span style="color: red;">Аккаунт уже существует, попробуйте другой.</span></strong></p>`);
                      } else {
$('#account_create_error').css('display', 'none');
golos.broadcast.accountCreateWithInvite('5KjRPYZw3YUcmWydxS55xg7FE9t6aAZzrdHQSph9343u92qpDLX',invite_secret,'dpos.space-reg',account_login,owner,active,posting,memo_key,json_metadata,[],function(oshibka,ok){
              if(!oshibka){
                  $('.btn btn-primary').css('display', 'none');
                  $('#account_created').html(`<h2>Аккаунт успешно создан</h2>
<p><strong><span style="color: red;">Сохраните ключи, указанные ниже: они не восстанавливаются.</span></strong></p>
<ul><li>${account_login} - логин</li>
<li>${keys['owner']} - Owner ключ</li>
<li>${keys['active']} - активный ключ</li>
<li>${keys['posting']} - Постинг ключ</li>
<li>${keys['memo']} - Memo ключ</li></ul>`);
                  download('golos-account.txt','dpos.space\r\n\r\nAccount login: '+account_login+'\r\nOwner key: '+keys['owner']+'\r\nActive key: '+keys['active']+'\r\nPosting key: '+keys['posting']+'\r\nMemo key: '+keys['memo']+'');
              }
              else{
                  window.alert(oshibka);
                $('#account_create_error').css('display', 'block');
                  $('#account_create_error').html(`<h2>Ошибка создания аккаунта</h2>
<p>${JSON.stringify(oshibka)}</p>`);
              }
          });
      }
  });
}

$('input[name=newAccountName]')  .change(function () {
  golos.api.getAccounts([$('input[name=newAccountName]').val().trim()], function(err, res) {
    if (!err && res.length !== 0) {
      $('#check_login').empty();
      $('#check_login').html('<strong><span style="color: red;">Аккаунт существует. Введите иной логин.</span></strong>');
    } else {
      $('#check_login').empty();
      $('#check_login').html('Аккаунт свободен.');
    }
  });
});