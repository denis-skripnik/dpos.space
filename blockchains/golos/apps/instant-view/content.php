<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div>
<form>
<label for="golos_id_url">Url поста на golos.id (без инвайта):<br>
<input name="golos_id_url" type="url" value=""></label>
<label for="convert_url">Конвертировать Url <input type="button" name="convert_url" value="Конвертировать Url"></label>
</form>
<div id="result_url"></div>
</div>';
?>