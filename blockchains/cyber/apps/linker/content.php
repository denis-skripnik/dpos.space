<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<div id="auth_msg" style="display: none;"><p>Вы не авторизовались. Просьба сделать это <a href="'.$conf['siteUrl'].'cyber/accounts" target="_blank">здесь</a></p></div>                        
                        <div id="seed_page">
                        <h2>Пропускная способность адреса <span id="now_address"></span></h2>
                        <p><strong><span id="bandwidth_remained"></span> из <span id="bandwidth_max_value"></span></strong></p>
<hr>                        
<div id="result"></div>
<form>
<p><input type="text" name="keyword_ipfs_hash" value="" placeholder="Введите IPFS хеш запроса"></p>
<p><input type="text" name="data_ipfs_hash" value="" placeholder="Введите ipfs хеш с данными"></p>
<p><input type="button" onclick="sendIpfsHashes(this.form.keyword_ipfs_hash.value, this.form.data_ipfs_hash.value)" value="Создать"></p>
</form></div>
'; ?>