async function main () {
      const node = await window.Ipfs.create()

    document.getElementById('files').addEventListener('change', async function(e)
    {
        //Получаем объект выбранных файлов
        var files = e.target.files;
        //Я не использую мульти выбор файлов для простоты. Поэтому берем сразу первый элемент массива
        var file = files[0];
    
            const fileAdded = await node.add({
                path: file.name,
                content: file
              })
            
              $('#upload_result').html('Файл добавлен:' + fileAdded.path + ', Сохраните cid для создания ссылки: <textarea readonly id="file_cid">' + fileAdded.cid + '</textarea> (<input type="button" onclick="copyText(`file_cid`)" value="копировать в буфер обмена">)');
            });

$("input[name='add_text_to_ipfs']").click(async function() {
    let text = $('#text_to_ipfs').val();
    const fileAdded = await node.add({
        path: parseInt(new Date().getTime()) + '.txt',
        content: text
      })
      $('#text_result').html('Файл добавлен:' + fileAdded.path + ', Сохраните cid для создания ссылки: <textarea readonly id="text_cid">' + fileAdded.cid + '</textarea> (<input type="button" onclick="copyText(`text_cid`)" value="копировать в буфер обмена">)');
    });

}
  
  main()