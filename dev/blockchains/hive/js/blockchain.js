function checkWorkingNode() {
    const NODES = [
        'https://anyx.io',
        'https://rpc.usesteem.com'
    ];
    let node = localStorage.getItem("hive_node") || NODES[0];
    const idx = Math.max(NODES.indexOf(node), 0);
    let checked = 0;
    const find = (idx) => {
        if (idx >= NODES.length) {
            idx = 0;
        }
        if (checked >= NODES.length) {
            alert("no working nodes found");
            return;
        }
        node = NODES[idx];
        console.log("check", idx, node);
        hive.api.setOptions({url: node});
        try {
            hive.api.stop();
        } catch(e) {
        }
        
        let timeout = false;
        let timer = setTimeout(() => {
            console.log("timeout", NODES[idx])
            timeout = true;
            find(idx + 1);
        }, 3000);
        hive.api.getDynamicGlobalPropertiesAsync()
            .then(props => {
                if(!timeout) {
                    check = props.head_block_number;
                    console.log("found working node", node);
                    localStorage.setItem("hive_node", node);
                    clearTimeout(timer);
                }
            })
            .catch(e => {
                console.log("connection error", node, e);
                find(idx + 1);
            });
    }
    find(idx);
  }
  checkWorkingNode();

let current_user = JSON.parse(localStorage.getItem("hive_current_user"));
if (current_user) {
var hive_login = current_user.login;
var posting_key = sjcl.decrypt('dpos.space_hive_' + hive_login + '_postingKey', current_user.posting);
var active_key = sjcl.decrypt('dpos.space_hive_' + hive_login + '_activeKey', current_user.active);
$( document ).ready(function() {
    if (!posting_key) {
        document.getElementById('auth_msg').style = 'display: block';
        document.getElementById('posting_page').style = 'display: none';
       }
if (!active_key) {
    document.getElementById('active_auth_msg').style = 'display: block';
    document.getElementById('active_page').style = 'display: none';
}
});    
} else {
    $( document ).ready(function() {
        if (!posting_key) {
            document.getElementById('auth_msg').style = 'display: block';
            document.getElementById('posting_page').style = 'display: none';
            document.getElementById('active_page').style = 'display: none';   
        }
        });
        }

var users = JSON.parse(localStorage.getItem('hive_users'));
$( document ).ready(function() {
            if (users && users.length > 0) {
                document.getElementById('show_accounts_list').style = 'display: block';
    } else {
        document.getElementById('show_accounts_list').style = 'display: none';
    }
            });

function spoiler(elem)
{
    style = document.getElementById(elem).style;
    style.display = (style.display == 'block') ? 'none' : 'block';
}

function selectAccount() {
    let current_user = JSON.parse(localStorage.getItem("hive_current_user"));
    users = JSON.parse(localStorage.getItem('hive_users'));
    if (users) {
    let radioButtons = '';
    if (users.length === 1) {
        radioButtons += '<input type="radio" name="users" value="' + users[0].login + '" placeholder="' + users[0].login + '" checked> ' + users[0].login + '<a onclick="deleteAccount(`' + users[0].login + '`);">Удалить</a><br />';
    } else if (users.length > 1) {
    for (user of users) {
        if (current_user.login === user.login) {
        radioButtons += '<input type="radio" name="users" value="' + user.login + '" placeholder="' + user.login + '" checked> ' + user.login + ' <a onclick="deleteAccount(`' + user.login + '`);">Удалить</a><br />';
        }     else {
            radioButtons += '<input type="radio" name="users" value="' + user.login + '" placeholder="' + user.login + '"> ' + user.login + '<a onclick="deleteAccount(`' + user.login + '`);">Удалить</a><br />';
        }
    }
    }
    $('#accounts').html(radioButtons);
}
}

function deleteAccount(login) {
    let new_list = [];
    if (users.length > 1) {
    for (let user of users) {
    if (user.login !== login) {
        new_list.push(user);
    }
    }
    localStorage.setItem("hive_users", JSON.stringify(new_list));
    selectAccount()
    $('#delete_msg').html('Аккаунт ' + login + ' удалён из списка.');
    } else if (users.length === 1) {
        selectAccount()
            $('#delete_msg').html('Аккаунт ' + login + ' удалён из списка.');
            localStorage.removeItem('hive_users');
            localStorage.removeItem('hive_current_user');
        }
}

function getRadioValue(radioboxGroupName)
{
    group=document.getElementsByName(radioboxGroupName);
    for (x=0;x<group.length;x++)
    {
        if (group[x].checked)
        {
if (users) {
for (let user of users) {
if (user.login === group[x].value) {
    let acc_data = {login: user.login, posting: user.posting, active: user.active};
    localStorage.setItem("hive_current_user", JSON.stringify(acc_data));
$('#select_msg').html('Аккаунт ' + user.login + ' выбран.');
}
}
}
                return (group[x].value);
        }
    }
    return (false);
}
