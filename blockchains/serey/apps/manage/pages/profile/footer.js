if(0<$('.profile-update').length){
    steem.api.getAccounts([serey_login],function(err,response){
        if(!err){
            let json_metadata=response[0].json_metadata;
            let metadata;
            if(''==json_metadata){
                metadata={};
            }
            else{
                metadata=JSON.parse(json_metadata);
            }

            if(typeof metadata.profile == 'undefined'){
                metadata.profile={};
            }
            if(typeof metadata.profile.about !== 'undefined'){
                $('textarea[name=about]').html(metadata.profile.about);
}
if(typeof metadata.profile.name !== 'undefined'){
                $('input[name=nickname]').val(metadata.profile.name);
            }
            if(typeof metadata.profile.profile_image !== 'undefined'){
                $('input[name=avatar]').val(metadata.profile.profile_image);
            }
            if(typeof metadata.profile.cover_image !== 'undefined'){
                $('input[name=cover_image]').val(metadata.profile.cover_image);
            }
            if(typeof metadata.profile.gender !== 'undefined'){
                $('select[name=gender]').val(metadata.profile.gender);
            }
            if(typeof metadata.profile.interests !== 'undefined'){
                            $('input[name=Interests]').val(metadata.profile.interests.join(','));
            }
            if(typeof metadata.profile.location !== 'undefined'){
                $('input[name=location]').val(metadata.profile.location);
            }
            if(typeof metadata.profile.website !== 'undefined'){
                $('input[name=site]').val(metadata.profile.website);
            }
            if(typeof metadata.profile.mail !== 'undefined'){
                $('input[name=mail]').val(metadata.profile.mail);
            }
            if(typeof metadata.profile.facebook !== 'undefined'){
                $('input[name=facebook]').val(metadata.profile.facebook);
            }
            if(typeof metadata.profile.instagram !== 'undefined'){
                $('input[name=instagram]').val(metadata.profile.instagram);
            }
            if(typeof metadata.profile.twitter !== 'undefined'){
                $('input[name=twitter]').val(metadata.profile.twitter);
            }
            if(typeof metadata.profile.telegram !== 'undefined'){
                $('input[name=telegram]').val(metadata.profile.telegram);
            }
            if(typeof metadata.profile.vk !== 'undefined'){
                $('input[name=vk]').val(metadata.profile.vk);
            }
            if(typeof metadata.profile.skype !== 'undefined'){
                $('input[name=skype]').val(metadata.profile.skype);
            }
            if(typeof metadata.profile.whatsapp !== 'undefined'){
                $('input[name=whatsapp]').val(metadata.profile.whatsapp);
            }
            if(typeof metadata.profile.viber !== 'undefined'){
                $('input[name=viber]').val(metadata.profile.viber);
            }
        }
        else{
console.log(err);
        }
    });
}

function profile_save(){
    steem.api.getAccounts([serey_login],function(err,response){
        if(!err){
            let json_metadata=response[0].json_metadata;
            let metadata;
            if(''==json_metadata){
                metadata={};
            }
            else{
                metadata=JSON.parse(json_metadata);
            }
if (!metadata.profile) {
                metadata.profile={};
}
                metadata.profile.name= $('input[name=nickname]').val().trim();
metadata.profile.about=$('textarea[name=about]').html().trim();
metadata.profile.profile_image=$('input[name=avatar]').val().trim();
metadata.profile.cover_image =$('input[name=cover_image]').val().trim();
metadata.profile.gender=$('.profile-update select[name=gender]').val();
            metadata.profile.location=$('input[name=location]').val().trim();
            var fullInterests = $('input[name=Interests]').val().trim();
            var i = fullInterests.split(',');
            var i2 = [];
            i.forEach(function(item){
                    i2.push(item.toLowerCase().trim());
                        
            });
            i2 = unique(i2);
            metadata.profile.interests = i2;
            metadata.profile.website=$('input[name=site]').val().trim();
                        metadata.profile.mail=$('input[name=mail]').val().trim();
            metadata.profile.facebook=$('input[name=facebook]').val().trim();
            metadata.profile.instagram=$('input[name=instagram]').val().trim();
            metadata.profile.twitter=$('input[name=twitter]').val().trim();
            metadata.profile.vk=$('input[name=vk]').val().trim();
            metadata.profile.telegram=$('input[name=telegram]').val().trim();
            metadata.profile.skype=$('input[name=skype]').val().trim();
            metadata.profile.viber=$('input[name=viber]').val().trim();
            metadata.profile.whatsapp=$('input[name=whatsapp]').val().trim();

            json_metadata=JSON.stringify(metadata);
var memo = response[0].memo_key;
            steem.broadcast.accountUpdate(active_key, serey_login, undefined, undefined, undefined, memo, json_metadata, function(err, result){
                if(!err){
                    window.alert('Ок. Ваш профиль сохранён.');
                }
                else{
                    window.alert(err);
                }
            });
        } else {
            window.alert('Ошибка соединения с нодой или аккаунт не существует. Просьба попробовать ещё раз позже.');
        }
    });
        }

    var featuredImage = [];
   window.ondragover = function(e) {e.preventDefault()}
   window.ondrop = function(e) {e.preventDefault(); upload(e.dataTransfer.files[0]); }
function upload(file, field_name) {
   if (!file || !file.type.match(/image.*/)) return;
   document.getElementById("addimg_" + field_name).classList.add('Загрузка');
   var fd = new FormData();
   fd.append("image", file);
   var xhr = new XMLHttpRequest();
   xhr.open("POST", "https://api.imgur.com/3/image.json");
   xhr.onload = function() {
       var imgurl = JSON.parse(xhr.responseText).data.link;

$('input[name=' + field_name + ']').val(imgurl);
       featuredImage.push(imgurl);
       document.getElementById("addimg_" + field_name).classList.add('hasload');


   }
   xhr.setRequestHeader('Authorization', 'Client-ID 372d5f766d47d1d');

   xhr.send(fd);
}