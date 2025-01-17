$(document).ready(function () {
    $("#uploadImage").on("change", { extra: "#imageResult" }, imageUploaded);
});

function imageUploaded(e) {
    if (this.files && this.files[0]) {
        var reader = new FileReader();

        var imageArea = e.data.extra;
        reader.onload = function (e) {
            $(imageArea).attr("src", e.target.result);
            $(imageArea).siblings("button").show();
        };
        reader.readAsDataURL(this.files[0]);
    }
}

function readImage(upload) {
    return new Promise((resolve, reject) => {
        if (upload.files && upload.files[0]) {
            let reader = new FileReader();
            reader.onloadend = function (e) {
                resolve(e.target.result);
            };
            try {
                reader.readAsDataURL(upload.files[0]);
            } catch (err) {
                reject(err);
            }
        } else {
            resolve("");
        }
    });
}
