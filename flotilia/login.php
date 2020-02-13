<?php
if (!isset($_POST['key']) ){
echo '<form method="post" action="">
<input type="text" name="key" value="">
<input type="submit" value="">
</form>';
} else {
$_SESSION['key'] = $_POST['key'];
echo '<form method="post" action="">
<input type="text" name="key" value="">
<input type="submit" value="">
</form>';
}
