axios.defaults.baseURL = 'https://deimos.cybernode.ai';

function blocksData(start_block, end_block) {
   axios.get('/block?height=' + start_block)
  .then(function (response) {
    // handle success
    document.getElementById("sig1").innerHTML = response.data.result.block_id.hash;
    console.log(response);
  })
  .catch(function (error) {
    // handle error
    console.log(error);
  })
  .then(function () {
    // always executed
  });
  axios.get('/block?height=' + end_block)
  .then(function (response) {
    // handle success
    document.getElementById("sig2").innerHTML = response.data.result.block_id.hash;
    console.log(response);
  })
  .catch(function (error) {
    // handle error
    console.log(error);
  })
  .then(function () {
    // always executed
  });
    }

    function calculate() {
        var sig1 = document.getElementById("sig1").value,
        sig2 = document.getElementById("sig2").value,
        participants = document.getElementById("participants").value;
        participants = parseInt(participants);
        
        if(sig1) sig1 = sig1.trim();
        if(sig2) sig2 = sig2.trim();
        
	// собственно вычисления    
	let h = sig1 + sig2;
        let d = bigInt(h, 16).mod(participants);
        console.log(d);

	document.getElementById("hash").value = h;
        document.getElementById("luckyNumber").value = (d.value);
        
    }

    function updateValues()
    {
	//console.log("updateValues = " + JSON.stringify(site));     
        var vars = [], hash;
        var hashes = window.location.href.slice(window.location.href.indexOf("?") + 1).split("&");
        for(var i = 0; i < hashes.length; i++)
        {
            hash = hashes[i].split("=");
            vars.push(hash[0]);
            vars[hash[0]] = hash[1];
        }
        if(vars["sig1"]) {
            document.getElementById("sig1").value = vars["sig1"];
        }
        if(vars["sig2"]) {
            document.getElementById("sig2").value = vars["sig2"];
        }
        if(vars["p"]) {
            document.getElementById("participants").value = vars["p"];
        }
    }    
