<?php
class TG {
  
    public $token = '';
  
    public function __construct($token) {
        $this->token = $token; 
    }
      
    public function send($id, $message,$reply_to_message_id,$keyboard) {   
		
		//Удаление клавы
		if($keyboard == "DEL"){		
			$keyboard = array(
				'remove_keyboard' => true
			);
		}
		if($keyboard){
			//Отправка клавиатуры
			$encodedMarkup = json_encode($keyboard);
			
			$data = array(
				'chat_id'      => $id,
				'text'     => $message,
				'parse_mode' => 'Markdown',
				'reply_markup' => $encodedMarkup
			);
		}else{
			//Отправка сообщения
			$data = array(
				'chat_id'      => $id,
				'text'     => $message,
			);
		}
       if ($reply_to_message_id != 0) {
		   $data['reply_to_message_id'] = $reply_to_message_id;
	   }
        $out = $this->request('sendMessage', $data);       
        return $out;
    }         
	
    public function voice($id, $voice,$reply_to_message_id,$keyboard) {   
		
		//Удаление клавы
		if($keyboard == "DEL"){		
			$keyboard = array(
				'remove_keyboard' => true
			);
		}
		if($keyboard){
			//Отправка клавиатуры
			$encodedMarkup = json_encode($keyboard);
			
			$data = array(
				'chat_id'      => $id,
				'voice'     => $voice,
				'reply_markup' => $encodedMarkup
			);
		}else{
			//Отправка сообщения
			$data = array(
				'chat_id'      => $id,
				'file_id'     => $voice,
			);
		}
       if ($reply_to_message_id != 0) {
		   $data['reply_to_message_id'] = $reply_to_message_id;
	   }
        $out = $this->request('sendMessage', $data);       
        return $out;
    }

    public function edit($id, $msg_id, $message,$keyboard) {   
		
		//Удаление клавы
		if($keyboard == "DEL"){		
			$keyboard = array(
				'remove_keyboard' => true
			);
		}
		if($keyboard){
			//Отправка клавиатуры
			$encodedMarkup = json_encode($keyboard);
			
			$data = array(
				'chat_id'      => $id,
				'message_id' => $msg_id,
				'text'     => $message,
				'reply_markup' => $encodedMarkup
			);
		}else{
			//Отправка сообщения
			$data = array(
				'chat_id'      => $id,
				'message_id' => $msg_id,
				'text'     => $message
			);
		}
       
        $out = $this->request('editMessageText', $data);       
        return $out;
    }
	
	public function forward($id, $from_chat_id, $msg_id) {   
		
			$data = array(
				'chat_id'      => $id,
				'from_chat_id' => $from_chat_id,
				'disable_notification' => false,
				'message_id' => $msg_id
			);
       
        $out = $this->request('forwardMessage', $data);       
        return $out;
    }
	
	public function getPhoto($data){
		$out = $this->request('getFile', $data);        
        return $out;
	}  
	
	public function savePhoto($url,$puth){
		$ch = curl_init('https://api.telegram.org/file/bot' . $this->token .  '/' . $url);
		$fp = fopen($puth, 'wb');
		curl_setopt($ch, CURLOPT_FILE, $fp);
		curl_setopt($ch, CURLOPT_HEADER, 0);
		curl_exec($ch);
		curl_close($ch);
		fclose($fp);
	}
	
    public  function request($method, $data = array()) {
        $curl = curl_init(); 
          
        curl_setopt($curl, CURLOPT_URL, 'https://api.telegram.org/bot' . $this->token .  '/' . $method);
        curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($curl, CURLOPT_CUSTOMREQUEST, 'POST');
        curl_setopt($curl, CURLOPT_POST, true);
        curl_setopt($curl, CURLOPT_POSTFIELDS, $data); 
          
        $out = json_decode(curl_exec($curl), true); 
          
        curl_close($curl); 
          
        return $out; 
    }
}
?>