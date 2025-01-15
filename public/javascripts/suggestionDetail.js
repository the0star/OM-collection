$(document).ready(function () {
	jdd.compare();

	let suggestion_id = location.pathname.split("/")[2];
	$("#ban").on("click", function () {
		$.post("/user/issueBan", { name: $(this).data("name") }).done(function (
			result
		) {
			let status = result.err ? "danger" : "success";
			showAlert(status, result.message);
		});
	});
	$("#delete").on("click", () => {
		$.post("/suggestion/refuse", {
			_id: suggestion_id,
			reason: $("input#reason").val(),
		}).done(function (result) {
			let status = result.err ? "danger" : "success";
			showAlert(status, result.message);
		});
	});
	$("#save").on("click", () => {
		$.post(`/suggestion/approve`, {
			_id: suggestion_id,
			data: $("textarea#final").val(),
			reason: $("input#reason").val(),
		}).done(function (result) {
			let status = result.err ? "danger" : "success";
			showAlert(status, result.message);
		});
	});
});
