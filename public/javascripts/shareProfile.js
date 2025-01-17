$(document).ready(function () {
    $("#copyLink").on("click", copyCollectionLink);
});

function copyCollectionLink() {
    var copyText = document.getElementById("userLink");
    copyText.select();
    copyText.setSelectionRange(0, 9999);
    document.execCommand("copy");
    showAlert("success", "Link successfully copied!");
}
