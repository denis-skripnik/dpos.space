var Datastore = require('nedb')
  , db = new Datastore({ filename: './balances.db', autoload: true });
  db.persistence.setAutocompactionInterval(1000 * 30);

  function getTop(type) {
    return new Promise((resolve, reject) => {
        db.findOne({type}, (err,data) => {
               if(err) {
                      reject(err);
               } else {
                resolve(data);
              }
        });
      });
    }

    function updateTop(type, data) {
  return new Promise((resolve, reject) => {
  db.update({type}, {type, data}, {upsert:true}, (err, result) => {
if (err) {
  reject(err);
} else {
       resolve(result);
}
  });
  });
}

function findAllTop() {
  return new Promise((resolve, reject) => {
  db.find({}, (err, result) => {
if (err) {
  reject(err);
} else {
       resolve(result);
}
      });
});
}

module.exports.getTop = getTop;
module.exports.updateTop = updateTop;