$(document).ready(function() {
  $('#table').DataTable( {
    "language": {
      "decimal": ",",
      "thousands": ".",
      "url": "//cdn.datatables.net/plug-ins/1.10.20/i18n/Russian.json"
      },
      "iDisplayLength": 50,
      "order": [[ 1, "desc" ], [ 2, "desc" ], [ 3, "desc" ], [ 4, "desc" ], [ 5, "desc" ]],
    "aoColumns": [
      null,
      { "orderSequence": [ "desc" ] },
      { "orderSequence": [ "desc" ] },
      { "orderSequence": [ "desc" ] },
      { "orderSequence": [ "desc" ] },
      { "orderSequence": [ "desc" ] }
      ],
    "aoColumnDefs": [
{ 'bSortable': false, 'aTargets': [ 0 ] }
],
    } );
});