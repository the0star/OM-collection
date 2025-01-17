$(function () {
    initTableSorter();
    $("form#filters").on("change", initTableSorter);
});

function initTableSorter() {
    // Initialize tablesorter
    // ***********************
    $("table")
        .tablesorter({
            theme: "bootstrap",
            widthFixed: true,
            sortLocaleCompare: true, // needed for accented characters in the data
            sortList: [[0, 1]],
            widgets: ["filter", "columns"],
            widgetOptions: {
                columns: ["primary", "secondary", "tertiary"],
                filter_reset: ".reset",
                filter_cssFilter: [
                    "form-control",
                    "form-control",
                    "form-control",
                    "form-control",
                    "form-control",
                    "form-control",
                    "form-control",
                    "form-control",
                    "form-control",
                ],
            },
        })
        .bind("pagerComplete", function (e, c) {
            $("#loading").addClass("d-none");
            $(".unlocked").parents("td").css("background-color", "#e9f7ef");
        })
        // initialize the pager plugin
        // ****************************
        .tablesorterPager({
            // **********************************
            //  Description of ALL pager options
            // **********************************

            // target the pager markup - see the HTML block below
            container: $(".pager"),

            // If you want to use ajaxUrl placeholders, here is an example:
            // ajaxUrl: "http:/mydatabase.com?page={page}&size={size}&{sortList:col}"
            // where {page} is replaced by the page number (or use {page+1} to get a one-based index),
            // {size} is replaced by the number of records to show,
            // {sortList:col} adds the sortList to the url into a "col" array, and {filterList:fcol} adds
            // the filterList to the url into an "fcol" array.
            // So a sortList = [[2,0],[3,0]] becomes "&col[2]=0&col[3]=0" in the url
            // and a filterList = [[2,Blue],[3,13]] becomes "&fcol[2]=Blue&fcol[3]=13" in the url
            ajaxUrl:
                "/getTreeData?page={page}&{filterList:filter}&{sortList:name}" +
                "&path=" +
                window.location.pathname +
                getFilters(),

            // use this option to manipulate and/or add additional parameters to the ajax url
            customAjaxUrl: function (table, url) {
                // manipulate the url string as you desire
                // url += '&currPage=' + window.location.pathname;

                // trigger a custom event; if you want
                $(table).trigger("changingUrl", url);
                // send the server the current page
                return url;
            },

            ajaxError: null,
            // function( config, xhr, settings, exception ) {
            //   // returning false will abort the error message
            //   // the code below is the default behavior when this callback is set to `null`
            //   return
            //     xhr.status === 0 ? 'Not connected, verify Network' :
            //     xhr.status === 404 ? 'Requested page not found [404]' :
            //     xhr.status === 500 ? 'Internal Server Error [500]' :
            //     exception === 'parsererror' ? 'Requested JSON parse failed' :
            //     exception === 'timeout' ? 'Time out error' :
            //     exception === 'abort' ? 'Ajax Request aborted' :
            //     'Uncaught error: ' + xhr.statusText + ' [' + xhr.status + ']';
            // },

            // add more ajax settings here
            // see http://api.jquery.com/jQuery.ajax/#jQuery-ajax-settings
            ajaxObject: {
                type: "GET", // default setting
                dataType: "json",
            },

            ajaxProcessing: function (data) {
                if (data && data.hasOwnProperty("rows")) {
                    return [data.total_rows, data.rows, data.headers];
                }
            },

            // Set this option to false if your table data is preloaded into the table, but you are still using ajax
            processAjaxOnInit: true,

            // output string - default is '{page}/{totalPages}';
            // possible variables: {size}, {page}, {totalPages}, {filteredPages}, {startRow}, {endRow}, {filteredRows} and {totalRows}
            // also {page:input} & {startRow:input} will add a modifiable input in place of the value
            output: "{startRow} to {endRow} ({totalRows})",

            // apply disabled classname (cssDisabled option) to the pager arrows when the rows
            // are at either extreme is visible; default is true
            updateArrows: true,

            // starting page of the pager (zero based index)
            page: 0,

            // Number of visible rows - default is 10
            size: 25,

            // Saves the current pager page size and number (requires storage widget)
            savePages: true,
            // Saves tablesorter paging to custom key if defined.
            // Key parameter name used by the $.tablesorter.storage function.
            // Useful if you have multiple tables defined
            storageKey: "tablesorter-pager",

            // Reset pager to this page after filtering; set to desired page number (zero-based index),
            // or false to not change page at filter start
            pageReset: 0,

            // if true, the table will remain the same height no matter how many records are displayed.
            // The space is made up by an empty table row set to a height to compensate; default is false
            fixedHeight: false,

            // remove rows from the table to speed up the sort of large tables.
            // setting this to false, only hides the non-visible rows; needed if you plan to
            // add/remove rows with the pager enabled.
            removeRows: false,

            // If true, child rows will be counted towards the pager set size
            countChildRows: false,

            // css class names of pager arrows
            cssNext: ".next", // next page arrow
            cssPrev: ".prev", // previous page arrow
            cssFirst: ".first", // go to first page arrow
            cssLast: ".last", // go to last page arrow
            cssGoto: ".gotoPage", // page select dropdown - select dropdown that set the "page" option

            cssPageDisplay: ".pagedisplay", // location of where the "output" is displayed
            cssPageSize: ".pagesize", // page size selector - select dropdown that sets the "size" option

            // class added to arrows when at the extremes; see the "updateArrows" option
            // (i.e. prev/first arrows are "disabled" when on the first page)
            cssDisabled: "disabled", // Note there is no period "." in front of this class name
            cssErrorRow: "tablesorter-errorRow", // error information row
        });
}

function getFilters() {
    $("#loading").removeClass("d-none");
    let str = "";
    str +=
        "&rarity=" +
        encodeURIComponent($("input[name='rarity']:checked").val());
    str +=
        "&attribute=" +
        encodeURIComponent($("input[name='attribute']:checked").val());
    str += "&type=" + encodeURIComponent($("input[name='type']:checked").val());
    return str;
}
