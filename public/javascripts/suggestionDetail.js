$(document).ready(function () {
    jdd.compare();

    let suggestion_id = location.pathname.split("/")[2];

    $("#ban").on("click", function () {
        const name = $(this).data("name");
        if (!confirm("Ban " + name + " from making suggestions?")) return;
        $.post("/user/issueBan", { name: name }).done(function (result) {
            let status = result.err ? "danger" : "success";
            showAlert(status, result.message);
        });
    });

    // "Refuse" (previously labeled "Delete suggestion" — the action has
    // always been a status flip, not a deletion). Keep listening on the
    // old #delete selector too in case any cached HTML is still around.
    function refuseHandler() {
        if (!confirm("Refuse this suggestion?")) return;
        $.post("/suggestion/refuse", {
            _id: suggestion_id,
            reason: $("input#reason").val(),
        })
            .done(function (result) {
                let status = result.err ? "danger" : "success";
                showAlert(status, result.message);
            })
            .fail(function (xhr) {
                let r = xhr.responseJSON || {};
                showAlert(
                    "danger",
                    r.message || "Failed to refuse suggestion."
                );
            });
    }
    $("#refuse, #delete").on("click", refuseHandler);

    $("#save").on("click", () => {
        if (!confirm("Approve this suggestion and apply the changes?")) return;
        $.post(`/suggestion/approve`, {
            _id: suggestion_id,
            data: $("textarea#final").val(),
            reason: $("input#reason").val(),
        })
            .done(function (result) {
                let status = result.err ? "danger" : "success";
                showAlert(status, result.message);
            })
            .fail(function (xhr) {
                let r = xhr.responseJSON || {};
                showAlert(
                    "danger",
                    r.message || "Failed to approve suggestion."
                );
            });
    });
});
