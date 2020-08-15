$(document).ready(function(){
	resetFilters();
	$("form :input").on('click', formChanged);
	$("div#filters :input").on('change', filterApplied);
});

function formChanged(e) {
	var form = $(this).closest('form');
	var type = $(this).attr("type");
	if (type == 'checkbox') {
		var checkboxes = $(form).find('input[type=checkbox]:checked');
		var radio = $(form).find('input[type=radio');
		if (checkboxes.length == 0) {
			$(radio).prop('checked', true);
		}
		else if ($(radio).prop('checked')) {
			$(radio).prop('checked', false);
		}
	}
	if (type == 'radio') {
		var checkboxes = $(form).find('input[type=checkbox]:checked');
		if ($(this).prop('checked')) {
			$(checkboxes).each(function() {
				$(this).prop('checked', false);
			});
		}
	}
}

function filterApplied(e) {
	var filters = {};
	$("form").each(function() {
		var formId = $(this).attr("id");
		filters[formId] = "";
		$(this).find(":input[type=checkbox]:checked").each(function(index, obj) {
			if (index != 0) {
				filters[formId] += ", ";
			}
	        filters[formId] += "." + $(obj).attr("name");
	    });
	});

	$(".cardPreview").fadeOut(400).promise().done(function() {
		var cards = $(".cardPreview");
		Object.keys(filters).forEach(function(key) {
			if (filters[key] != "")
				cards = $(cards).filter(filters[key]);
		});
		cards.fadeIn(400);
		/*if (rarity != "") {
			$(".cardPreview").filter(rarity).fadeIn(400);
		} else {
			$(".cardPreview").fadeIn(400);
		}*/
	});
}

function resetFilters() {
	$("input[type=checkbox]").prop('checked', false);
	$("input[type=radio]").prop('checked', true);
}