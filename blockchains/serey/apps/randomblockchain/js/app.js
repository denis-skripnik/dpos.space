function blocksData(start_block, end_block) {
    steem.api.getBlock(start_block, function (err, res) {
    if (!err) {
        document.getElementById("sig1").innerHTML = res.witness_signature;
    } else {
        blocksData();
    }
        });
        steem.api.getBlock(end_block, function (error, result) {
    if (!error) {
        document.getElementById("sig2").innerHTML = result.witness_signature;
    } else {
        blocksData();
    }
        });
    }

    function calculate() {
        var sig1 = document.getElementById("sig1").value,
        sig2 = document.getElementById("sig2").value,
        participants = 3;
    
        if(sig1) sig1 = sig1.trim();
        if(sig2) sig2 = sig2.trim();
        
	// собственно вычисления    
	let h = keccak_256.update(sig1 + sig2).toString();
        //alert(bigInt(h, 16).mod(participants));
        let d = bigInt(h, 16).mod(participants);
        console.log(d);

	document.getElementById("hash").value = h;
        document.getElementById("luckyNumber").value = (d.value+1);
        
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
