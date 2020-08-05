<?php if (!defined('NOTLOAD')) exit('No direct script access allowed');
return '<h2>Выберите токен</h2>
<ol><li><a href="'.$conf['siteUrl'].'viz/top/shares">Соц. капитал</a></li>
<li><a href="'.$conf['siteUrl'].'viz/top/VIZ">VIZ</a></li>
<li><a href="'.$conf['siteUrl'].'viz/top/effective_shares">Эффективный соц. капитал</a></li>
<li><a href="'.$conf['siteUrl'].'viz/top/received_shares">Полученный делегированием соц. капитал</a></li>
<li><a href="'.$conf['siteUrl'].'viz/top/delegated_shares">Делегированный другим соц. капитал</a></li>
</ol>
'; ?>