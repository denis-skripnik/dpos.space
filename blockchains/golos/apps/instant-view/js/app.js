function replaseUrl(propertyName) {
    function upperToHyphenLower(match, offset, string) {
      return (offset > 0 && match === '/' ? "%2F" : "" || offset > 0 && match === ':' ? "%3A" : "" || offset > 0 && match === "@" ? "%40" : "" || offset > 0 && match === '&' ? '%26' : "");
    }
    return propertyName.replace(/\/|@|:|&/g, upperToHyphenLower);
  }

$(document).ready(function() {
    $('[name="convert_url"]').click(function() {
        let url = replaseUrl($('[name="golos_id_url"]').val().trim().split('?')[0]);
let tg_url = `https://t.me/iv?url=${url}&rhash=1d27d6e1501db6`
    let share_link = `<a href="https://t.me/share/url?url=${replaseUrl(tg_url)}">Поделиться в Telegram</a>`;
$('#result_url').html(`<p><strong>${tg_url}</strong></p>
<p><strong>${share_link}</strong></p>`);
})
});