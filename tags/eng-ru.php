<?php
function transliteration_ru($tag_en, $mode = 'torus') {
        $lang = [
            'ые' => 'yie',
            'щ' => 'shch',
            'ш' => 'sh',
            'ч' => 'ch',
            'ц' => 'cz',
            'й' => 'ij',
            'ё' => 'yo',
            'э' => 'ye',
            'ю' => 'yu',
            'я' => 'ya',
            'х' => 'kh',
            'ж' => 'zh',
            'а' => 'a',
            'б' => 'b',
            'в' => 'v',
            'г' => 'g',
            'д' => 'd',
            'е' => 'e',
            'з' => 'z',
            'и' => 'i',
            'к' => 'k',
            'л' => 'l',
            'м' => 'm',
            'н' => 'n',
            'о' => 'o',
            'п' => 'p',
            'р' => 'r',
            'с' => 's',
            'т' => 't',
            'у' => 'u',
            'ф' => 'f',
            'ъ' => 'xx',
            'ы' => 'y',
            'ь' => 'x',
         //   'ґ' => 'g',
        //    'є' => 'e',
         //   'і' => 'i',
          //  'ї' => 'i'
        ];
        $eng = array_flip($lang);
        if ($mode == 'torus') {
            if (substr($tag_en, 0, 4) != 'ru--') {
                return $tag_en;
            }
            $tag_en = substr($tag_en, 4);
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