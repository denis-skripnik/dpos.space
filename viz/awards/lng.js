function stroka() {
    var st = unescape(window.location.href );
    var i = false;
    var r = st.substring( st.lastIndexOf('/') + 1, st.length );
return r;
    }
var data_url = stroka();

var lang = window.navigator.language || navigator.userLanguage
console.log(lang);
if ( lang  === "en-US") {
	window.location.href = 'en/' + data_url;
} else if ( lang  === "ru-RU") {
	window.location.href = 'ru/' + data_url;
}