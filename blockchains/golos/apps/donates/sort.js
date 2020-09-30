$(document).ready(function() {
  $('#table').DataTable( {
                "language": {
      "decimal": ",",
      "thousands": ".",
                      "url": "//cdn.datatables.net/plug-ins/1.10.20/i18n/Russian.json"
                  },
    "order": [[ 1, "desc" ]],
            "aoColumns": [
                  null,
                  { "orderSequence": [ "desc" ] }
              ],
    "aoColumnDefs": [
{ 'bSortable': false, 'aTargets': [ 0 ] }
],
    } );
});