// https://jscompress.com/
window.generatedFormScript = function(){
	function serialize(e) {
		for (var n = [], t = 0; t < e.elements.length; t++) {
			var o = e.elements[t];
			if (o.name && !o.disabled && "file" !== o.type && "reset" !== o.type && "submit" !== o.type && "button" !== o.type)
				if ("select-multiple" === o.type)
					for (var p = 0; p < o.options.length; p++) o.options[p].selected && n.push(encodeURIComponent(o.name) + "=" + encodeURIComponent(o.options[p].value));
				else("checkbox" !== o.type && "radio" !== o.type || o.checked) && n.push(encodeURIComponent(o.name) + "=" + encodeURIComponent(o.value))
		}
		return n.join("&")
	}
	function checkWorkingNode() {
		const NODES = [
			"wss://viz.lexai.host/ws",
			"wss://solox.world/ws"
		];
		let node = localStorage.getItem("node") || NODES[0];
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
			viz.config.set("websocket", node);
			viz.api.getDynamicGlobalPropertiesAsync()
				.then(props => {
					console.log("found working node", node);
					localStorage.setItem("node", node);
				})
				.catch(e => {
					console.log("connection error", node, e);
					find(idx + 1);
				});
		}
		find(idx);
	}
	function checkLogin(formId){
		if (localStorage.getItem('login') && localStorage.getItem('PostingKey')) {
			viz_login = localStorage.getItem('login');
			posting_key = sjcl.decrypt(viz_login + '_postingKey', localStorage.getItem('PostingKey'));
		} else if (sessionStorage.getItem('login') && sessionStorage.getItem('PostingKey')) {
			viz_login = sessionStorage.getItem('login');
			posting_key = sjcl.decrypt(viz_login + '_postingKey', sessionStorage.getItem('PostingKey'));
		} else {
			document.getElementById(formId) && (document.getElementById(formId).style.display = "none");
				var authform = document.createElement('div');
				authform.innerHTML = '<form id="auth_form" action="index.html" method="GET">'+
				'<p class="auth_title"><strong>Пожалуйста авторизируйтесь</strong></p>'+
				'<p><input type="text" id="this_login" name="viz_login" placeholder="Ваш логин"></p>'+
				'<p><input type="password" name="posting" id="this_posting" placeholder="Приватный постинг ключ"></p>'+
				'<p><input type="submit" value="Войти"></p>'+
				'</form>';
				document.getElementById(formId).parentNode.insertAdjacentElement('beforeend', authform);
				document.getElementById("auth_form").onsubmit = function(e){
					e.preventDefault();
					AuthForm(formId);
				}
		}
	}
	async function AuthForm(formId) {
		let login = document.getElementById('this_login').value;
		let posting = document.getElementById('this_posting').value;

		if (localStorage.getItem('PostingKey')) {
			var isPostingKey = sjcl.decrypt(login + '_postingKey', localStorage.getItem('PostingKey'));
		} else if (sessionStorage.getItem('PostingKey')) {
			var isPostingKey = sjcl.decrypt(login + '_postingKey', sessionStorage.getItem('PostingKey'));
		} else {
			var isPostingKey = posting;
		}

		var resultIsPostingWif = viz.auth.isWif(isPostingKey);
		if (resultIsPostingWif === true) {
			const account_approve = await viz.api.getAccountsAsync([login]);
			const public_wif = viz.auth.wifToPublic(isPostingKey);
			let posting_public_keys = [];
			if (account_approve.length > 0) {
				for (key of account_approve[0].regular_authority.key_auths) {
					posting_public_keys.push(key[0]);
				}
			} else {
				window.alert('Вероятно, аккаунт не существует. Просьба проверить введённый логин.');
			}
			if (posting_public_keys.includes(public_wif)) {
				localStorage.setItem('login', login);
				localStorage.setItem('PostingKey', sjcl.encrypt(login + '_postingKey', posting));
				sessionStorage.setItem('login', login);
				sessionStorage.setItem('PostingKey', sjcl.encrypt(login + '_postingKey', posting));

				viz_login = login;
				posting_key = isPostingKey;
			} else if (account_approve.length === 0) {
				window.alert('Аккаунт не существует. Пожалуйста, проверьте его');
			} else {
				window.alert('Постинг ключ не соответствует пренадлежащему аккаунту.');
			}
		} else {
			window.alert('Постинг ключ имеет неверный формат. Пожалуйста, попробуйте ещё раз.');
		}
		if (!viz_login && !posting_key) {
			alert("Не удалось авторизироваться с текущей парой логин/ключ");
		} else {
			document.getElementById(formId) && (document.getElementById(formId).style.display = "block");
			document.getElementById("auth_form").remove();
		}
	}
	var formId = document.querySelector('.generated-form').id;
	document.querySelector('.generated-form').querySelector('button').disabled = true;
	var timeoutR = setTimeout(function checkViz(){
		if (window.hasOwnProperty('viz')) {
			console.log('done');
			checkWorkingNode();
			checkLogin(formId);
			document.querySelector('.generated-form').querySelector('button').disabled = false;
		} else {
			console.log('wait');
			timeoutR = setTimeout(checkViz, 50);
		}
	}, 0);
	document.querySelector('.generated-form').onsubmit = function(e){
		e.preventDefault();
		this.querySelector('button').disabled = true;
		var xhr = new XMLHttpRequest();
		xhr.open('POST', 'json_encode.php');
		xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
		xhr.onload = function() {
			if (xhr.status !== 200) {
				alert('Request failed.  Returned status of ' + xhr.status);
				return;
			}
			console.log(xhr.responseText);
			viz.broadcast.custom(posting_key, [], [viz_login], document.querySelector(".generated-form").id, xhr.responseText, function(err, result) {
				if (!err) {
					alert('Ок. custom отправлен')
					console.log(result);
				} else {
					alert('Ошибка: '+err)
				}
				document.querySelector('.generated-form').querySelector('button').disabled = false;
			});
		};
		xhr.send(serialize(document.querySelector('.generated-form')));
	}
}