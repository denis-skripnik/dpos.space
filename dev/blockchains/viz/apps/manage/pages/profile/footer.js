if(0<$('.profile-update').length){
    viz.api.getAccounts([viz_login],function(err,response){
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
                $('input[name=about]').val(metadata.profile.about);
}
if(typeof metadata.profile.nickname !== 'undefined'){
                $('input[name=nickname]').val(metadata.profile.nickname);
            }
            if(typeof metadata.profile.avatar !== 'undefined'){
                $('input[name=avatar]').val(metadata.profile.avatar);
            }
            if(typeof metadata.profile.gender !== 'undefined'){
                $('select[name=gender]').val(metadata.profile.gender);
            }
            if(typeof metadata.profile.birthday !== 'undefined'){
                let birthday = metadata.profile.birthday.split('.');
                if (parseInt(birthday[0]) >= 1 && parseInt(birthday[0]) <= 31) {
                $('input[name=birthday_day]').val(birthday[0]);
                }
                if (parseInt(birthday[1]) >= 1 && parseInt(birthday[1]) <= 12) {
                $('select[name=birthday_month]').val(birthday[1]);
                }
                if (parseInt(birthday[2]) >= 1900 && parseInt(birthday[2]) <= 2020) {
                $('input[name=birthday_year]').val(birthday[2]);
                }
            }
            if(typeof metadata.profile.interests !== 'undefined'){
                            $('input[name=Interests]').val(metadata.profile.interests.join(','));
            }
            if(typeof metadata.profile.location !== 'undefined'){
                $('input[name=location]').val(metadata.profile.location);
            }
            if(typeof metadata.profile.site !== 'undefined'){
                $('input[name=site]').val(metadata.profile.site);
            }
            if(typeof metadata.profile.mail !== 'undefined'){
                $('input[name=mail]').val(metadata.profile.mail);
            }
            if(typeof metadata.profile.services !== 'undefined'){
            let services = metadata.profile.services;
            if(typeof services.facebook !== 'undefined'){
                $('input[name=facebook]').val(services.facebook);
            }
            if(typeof services.instagram !== 'undefined'){
                $('input[name=instagram]').val(services.instagram);
            }
            if(typeof services.twitter !== 'undefined'){
                $('input[name=twitter]').val(services.twitter);
            }
            if(typeof services.telegram !== 'undefined'){
                $('input[name=telegram]').val(services.telegram);
            }
            if(typeof services.vk !== 'undefined'){
                $('input[name=vk]').val(services.vk);
            }
            if(typeof services.skype !== 'undefined'){
                $('input[name=skype]').val(services.skype);
            }
            if(typeof services.whatsapp !== 'undefined'){
                $('input[name=whatsapp]').val(services.whatsapp);
            }
            if(typeof services.viber !== 'undefined'){
                $('input[name=viber]').val(services.viber);
            }
        }
        }
        else{
console.log(err);
        }
    });
}

function profile_save(){
    viz.api.getAccounts([viz_login],function(err,response){
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
metadata.profile.nickname=$('input[name=nickname]').val().trim();
metadata.profile.about=$('input[name=about]').val().trim();
metadata.profile.avatar=$('input[name=avatar]').val().trim();
            metadata.profile.gender=$('.profile-update select[name=gender]').val().trim();
            metadata.profile.location=$('input[name=location]').val().trim();
            var fullInterests = $('input[name=Interests]').val().trim();
            var i = fullInterests.split(',');
            var i2 = [];
            i.forEach(function(item){
                    i2.push(item.toLowerCase().trim());
                        
            });
            i2 = unique(i2);
            metadata.profile.interests = i2;
            let b_day = $('input[name=birthday_day]').val().trim();
let b_month = $('select[name=birthday_month]').val().trim();
let b_year = $('input[name=birthday_year]').val().trim();            
if (!isNaN(b_day) && parseInt(b_day) >= 1 && parseInt(b_day) <= 31) {
    metadata.profile.birthday = b_day + '.' + b_month + '.' + b_year;
}
            metadata.profile.site=$('input[name=site]').val().trim();
                        metadata.profile.mail=$('input[name=mail]').val().trim();
            metadata.profile.services = {};
            metadata.profile.services.facebook=$('input[name=facebook]').val().trim();
            metadata.profile.services.instagram=$('input[name=instagram]').val().trim();
            metadata.profile.services.twitter=$('input[name=twitter]').val().trim();
            metadata.profile.services.vk=$('input[name=vk]').val().trim();
            metadata.profile.services.telegram=$('input[name=telegram]').val().trim();
            metadata.profile.services.skype=$('input[name=skype]').val().trim();
            metadata.profile.services.viber=$('input[name=viber]').val().trim();
            metadata.profile.services.whatsapp=$('input[name=whatsapp]').val().trim();

            json_metadata=JSON.stringify(metadata);
            console.log(json_metadata);
           viz.broadcast.accountMetadata(posting_key,viz_login,json_metadata,function(err, result){
                if(!err){
                    window.alert('Ок. Ваш профиль сохранён.');
                }
                else{
                    window.alert(JSON.stringify(err));
                }
            });
        } else {
            window.alert('Ошибка подключения к Ноде или аккаунт не существует. Просьба попробовать ещё раз позже или обновить страницу несколько раз.');
        }
    });
        }

    var featuredImage = [];
   window.ondragover = function(e) {e.preventDefault()}
   window.ondrop = function(e) {e.preventDefault(); upload(e.dataTransfer.files[0]); }
function upload(file) {
   if (!file || !file.type.match(/image.*/)) return;
   document.getElementById("addimg").classList.add('Загрузка');
   var fd = new FormData();
   fd.append("image", file);
   var xhr = new XMLHttpRequest();
   xhr.open("POST", "https://api.imgur.com/3/image.json");
   xhr.onload = function() {
       var imgurl = JSON.parse(xhr.responseText).data.link;

$('input[name=avatar]').val(imgurl);
       featuredImage.push(imgurl);
       document.getElementById("addimg").classList.add('hasload');


   }
   xhr.setRequestHeader('Authorization', 'Client-ID 372d5f766d47d1d');

   xhr.send(fd);
}