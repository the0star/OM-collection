$(document).ready(function () {
	$('#name').on('focusout', fillUniqueName);

	$("form").on("click", ".form-inline>button", removeItem);
	$("#addReward, #addAP").on("click", addItem);
	$("#submit").on("click", submitChange);
});

function fillUniqueName() {
  var name = $('#name').val();
  var uniqueName = name.replace(/[\\/:*?"<>|]/g, '');
  uniqueName = uniqueName.replace(/ /g, '_');
  $('#uniqueName').val(uniqueName);
}

function removeItem() {
	$(this).parent().remove();
}

function addItem() {
	var parentForm = $(this).data("target");
	var template = $(this).data("clone");
	$(parentForm).append($(template).html());
}

function submitChange() {
	var data = {};

	var formData = new FormData($("form")[0]);
	for (let pair of formData.entries()) {
		data[pair[0]] = pair[1];
	}

	if (data.type !== "Nightmare") {
		data.rewards = formatRewards(new FormData($("form")[1]), "card");
		data.ap = formatRewards(new FormData($("form")[2]), "page");
	}

	for (let key in data) {
		if (data[key] === "") {
			if (data.type === "Nightmare" && ["stages", "pageCost"].includes(key)) {
				continue;
			}
			showAlert("danger", "Please fill: "+key);
			return;
		}
	}

	var image = readImage($('#uploadImage')[0]);
	image
		.then(res => sendRequest(data, res))
		.catch(err => showAlert("danger", "Can't load image: " + err.message));
}

function sendRequest(data, image) {
	$.ajax({
		type: "post",
		url: "/event/updateEvent",
		contentType: "application/json",
		data: JSON.stringify({
			data: data,
			img: image,
			name: location.pathname.split("/")[2]
		})
	}).done(function(result) {
			if (result.err) {
				showAlert("danger", result.message);
				return;
			}
			showAlert("success", result.message);
			location.pathname = `/event/${encodeURIComponent($("input#name").val())}/edit`;  // temp
		});
}

function formatRewards(f, end) {
	var temp = {}, lst = [];
	for (let pair of f.entries()) {
		temp[pair[0]] = pair[1];
		if (pair[0] === end) {
			lst.push(temp);
			temp = {};
		}
	}
	return lst;
}
