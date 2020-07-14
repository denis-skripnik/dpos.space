	$('.btnNext').click(function() {
    	var a = window.location.href;
		let url = new URL('https://viz.dpos.space');
    	var c = a.substring(33);
    	var d = a.substring(34);
		if(c!==''){
			if(a.substring(29)=='home' + c){
				$('#page_1_tab').trigger('click');
				url.searchParams.delete('page');
				url.searchParams.set('page','page1');
			}else{
				if(a.substring(29)=='page1' + d){
					$('#page_2_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page2');
				}else if(a.substring(29)=='page2' + d){
					$('#page_3_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page3');
				}else if(a.substring(29)=='page3' + d){
					$('#page_4_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page4');
				}else if(a.substring(29)=='page4' + d){
					$('#page_5_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page5');
				}else if(a.substring(29)=='page5' + d){
					$('#page_6_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page6');
				}else if(a.substring(29)=='page6' + d){
					$('#page_7_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page7');
				}else if(a.substring(29)=='page7' + d){
					$('#page_8_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page8');
				}else if(a.substring(29)=='page8' + d){
					$('#page_9_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page9');
				}
			}
		}else{
			if(a.substring(29)=='home'){
				$('#page_1_tab').trigger('click');
				url.searchParams.delete('page');
				url.searchParams.set('page','page1');
			}else if(a.substring(29)=='page1'){
					$('#page_2_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page2');
				}else if(a.substring(29)=='page2'){
					$('#page_3_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page3');
				}else if(a.substring(29)=='page3'){
					$('#page_4_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page4');
				}else if(a.substring(29)=='page4'){
					$('#page_5_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page5');
				}else if(a.substring(29)=='page5'){
					$('#page_6_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page6');
				}else if(a.substring(29)=='page6'){
					$('#page_7_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page7');
				}else if(a.substring(29)=='page7'){
					$('#page_8_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page8');
				}else if(a.substring(29)=='page8'){
					$('#page_9_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page9');
				}
			}
    	history.replaceState(null, null, url);
    	history.pushState('','',url);
	});

	$('.btnPrevious').click(function() {
    	var a = window.location.href;
		let url = new URL('https://viz.dpos.space');
    	var c = a.substring(33);
    	var d = a.substring(34);
		if(c!==''){
				if(a.substring(29)=='page1' + d){
					$('#home-tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','home');
				}else if(a.substring(29)=='page2' + d){
					$('#page_1_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page1');
				}else if(a.substring(29)=='page3' + d){
					$('#page_2_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page2');
				}else if(a.substring(29)=='page4' + d){
					$('#page_3_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page3');
				}else if(a.substring(29)=='page5' + d){
					$('#page_4_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page4');
				}else if(a.substring(29)=='page6' + d){
					$('#page_5_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page5');
				}else if(a.substring(29)=='page7' + d){
					$('#page_6_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page6');
				}else if(a.substring(29)=='page8' + d){
					$('#page_7_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page7');
				}else if(a.substring(29)=='page9' + d){
					$('#page_8_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page8');
				}
		}else{
			if(a.substring(29)=='page1'){
					$('#home-tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','home');
				}else if(a.substring(29)=='page2'){
					$('#page_1_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page1');
				}else if(a.substring(29)=='page3'){
					$('#page_2_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page2');
				}else if(a.substring(29)=='page4'){
					$('#page_3_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page3');
				}else if(a.substring(29)=='page5'){
					$('#page_4_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page4');
				}else if(a.substring(29)=='page6'){
					$('#page_5_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page5');
				}else if(a.substring(29)=='page7'){
					$('#page_6_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page6');
				}else if(a.substring(29)=='page8'){
					$('#page_7_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page7');
				}else if(a.substring(29)=='page9'){
					$('#page_8_tab').trigger('click');
					url.searchParams.delete('page');
					url.searchParams.set('page','page8');
				}
			}
    	history.replaceState(null, null, url);
    	history.pushState('','',url);
	});

$('#start').click(function(){
	let page = 'home';
	let url = new URL('https://viz.dpos.space');
	url.searchParams.set('page',page);
    history.replaceState(null, null, url);
    history.pushState('','',url);
	$('#home-tab').trigger('click');
});

/*function newFunction() {
    $.each($('.nav-tabs .active'), function() {
        history.replaceState(null, null, '/');
        var newAdress = document.location.href + this.id;
        history.pushState(this.id, '', newAdress);
    })
};*/