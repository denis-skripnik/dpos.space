var user_following = [];

function follow(author, what)
{
	var json=JSON.stringify(['follow',{follower:golos_login,following:author,what:[what]}]);
	golos.broadcast.customJson(posting_key,[],[golos_login],'follow',json,function(err, result){
		console.log(JSON.stringify(err));
		if(!err){
console.log(JSON.stringify(result));
		}
		else{
			//user_card_action.wait=0;
			//add_notify('<strong>'+l10n.global.error_caption+'</strong> '+l10n.errors.broadcast,10000,true);
		}
	});
}


function getFollowing(login, start, me)
{
	golos.api.getFollowing(login, start, 'blog', 100, function(err, data){
		//console.log(err, data);
		if(data && data.length > 1 && me == true){
			var i = user_following.length - 1;
			var latest = '';
			if(start != '')
			{
				data.shift();
			}
			data.forEach(function (operation){
				i++;
				user_following[i] = operation.following;
				//console.log(i, operation.follower);
				latest = operation.following;
			});
			getFollowing(login, latest, me);
		}
	});
}

window.onFollowingLoaded = function(following) {
    following.forEach(function (data, num){
		$("#following_table").append('<tr><td><a href="/golos/profiles/' + data + '" target="_blank">@' + data + '</a></td>\
  <td><button class="btn btn-success" id="success' + num + '" style="display:none;" onclick="follow(\''+data+'\', \'blog\'); style.display=\'none\'; document.getElementById(\'warning' + num + '\').style.display=\'block\'; window.alert(\'Вы подписались на пользователя.\')">Подписаться</button><button class="btn btn-warning" id="warning' + num + '" onclick="follow(\''+data+'\', \'\'); style.display=\'none\'; document.getElementById(\'success' + num + '\').style.display=\'block\'; window.alert(\'Вы отписались от пользователя.\')">Отписаться</button></td>\
          </tr>');
    });
  };

function getFollowingMe()
{
	golos.api.getFollowing(golos_login, '', 'blog', 100, function(err, data){
		if(data)
		{
			var i = 0;
			data.forEach(function (operation){
				user_following[i] = operation.following;	
				i++;
                latest = operation.following;
            });
			if(latest != '' && data.length == 100)
			{
				getFollowing(login, latest, true);
			}

            window.onFollowingLoaded(user_following)
		}else{
			console.log(err);
		}
		
	});
}