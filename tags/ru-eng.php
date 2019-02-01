<?php
function transliteration_eng($tag_en, $mode = 'torus') {
        $lang = [
            'yie' => 'ые',
            'shch' => 'щ',
            'sh' => 'ш',
            'ch' => 'ч',
            'cz' => 'ц',
            'ij' => 'й',
            'yo' => 'ё',
            'ye' => 'э',
            'yu' => 'ю',
            'ya' => 'я',
            'kh' => 'х',
            'zh' => 'ж',
            'a' => 'а',
            'b' => 'б',
            'v' => 'в',
            'g' => 'г',
            'd' => 'д',
            'e' => 'е',
            'z' => 'з',
            'i' => 'и',
            'k' => 'к',
            'l' => 'л',
            'm' => 'м',
            'n' => 'н',
            'o' => 'о',
            'p' => 'п',
            'r' => 'р',
            's' => 'с',
            't' => 'т',
            'u' => 'у',
            'f' => 'ф',
            'xx' => 'ъ',
            'y' => 'ы',
            'x' => 'ь',
         //   'ґ' => 'g',
        //    'є' => 'e',
         //   'і' => 'i',
          //  'ї' => 'i'
        ];
        $eng = array_flip($lang);
        if ($mode == 'torus') {
            if (substr($tag_en, 0, 4) == 'ru--') {
                return $tag_en;
            }
            if (preg_match("/[а-я]+/u", $tag_en)) 
			$tag_en = substr_replace($tag_en, "ru--", 0, 0);
else 
            $tag_en = substr($tag_en, 0);
			$str = $tag_en;
            foreach ($eng as $lFrom => $lTo) {
                $from = $lFrom;
                $to = $lTo;
                $str = str_replace($from, $to, $str);
                $str = str_replace(mb_strtoupper($from, 'utf-8'), mb_strtoupper($to, 'utf-8'), $str);
            }
            return $str;
        }
    }
?>