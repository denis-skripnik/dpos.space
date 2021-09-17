$(document).ready(function() {
  $('#table').DataTable( {
                "language": {
      "decimal": ",",
      "thousands": ".",
                      "url": "//cdn.datatables.net/plug-ins/1.10.20/i18n/Russian.json"
                  },
      "iDisplayLength" : 50,
      "order": [[ 0, "asc" ]],
            "aoColumns": [
      { "orderSequence": [ "asc" ] },
                                null, null, null, null, null, null, null, null
],
    "aoColumnDefs": [
{ 'bSortable': false, 'aTargets': [ 0 ] }
],
    } );
});