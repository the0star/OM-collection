let changedCards = {};
let selectionMode = false;
let ownedCards = [];
let querystr = new URLSearchParams(document.location.search);
let nextHandler, nextHandler2, ias, ias2;
let totalCardCount = {
        demon: "--",
        memory: "--",
    },
    selectedCardCount = {
        demon: "--",
        memory: "--",
    };

//#region constants
const splitCardsByVisibility = (cards, currentCard) => {
    let cardImage = $(currentCard).find("img");
    if ($(currentCard).isInViewport()) {
        cards.visible.push(cardImage);
    } else {
        cards.invisible.push(cardImage);
    }
    return cards;
};

const cardOwned = (name) => ownedCards.includes(name);
const cardSelectionChanged = (name) => name in changedCards;
//#endregion

// TODO: create a single listener that controls all hover effects for dropdowns.

$(document).ready(function () {
    $("#search, #filters form").on("submit", applyFilters);
    $("#filters form input").change(updateFilterParams);
    $("#resetFilters").click(resetFilters);
    $("#viewMenuDropdown a").click(updateViewType);

    $("#demoncards>.ias, #memorycards>.ias").on(
        "click",
        ".cardPreview",
        cardClicked
    );

    $("button#manageCollection, button#saveManaging").on(
        "click",
        switchSelectionMode
    );
    $("button#selectAll").on("click", function () {
        switchSelectionAll(true);
    });
    $("button#deselectAll").on("click", function () {
        switchSelectionAll(false);
    });
    $("button#cancelManaging").on("click", function () {
        changedCards = {};
        switchSelectionMode.call();
    });

    let openedTab = localStorage.getItem("cardTab")
        ? localStorage.getItem("cardTab")
        : "demon-tab";
    $("#" + openedTab).tab("show");
    $("#demon-tab, #memory-tab").on("click", function () {
        localStorage.setItem("cardTab", $(this).attr("id"));
    });
});

$(window).on("beforeunload", () => {
    if (Object.keys(changedCards).length > 0)
        return confirm("Do you want to leave without saving your collection?");
});

function createCardDocuments(data, pageIndex) {
    let frag = document.createDocumentFragment();
    let cardsPerRow = getRowCapacity();
    let itemsPerPage = 100 - (100 % cardsPerRow);
    let totalPages = Math.ceil(data.length / itemsPerPage);
    let offset = pageIndex * itemsPerPage;
    let maxCardCount = data.length;
    if (data.length % cardsPerRow !== 0) {
        maxCardCount += cardsPerRow;
        maxCardCount -= maxCardCount % cardsPerRow;
    }

    for (
        let i = offset, len = offset + itemsPerPage;
        i < len && i < maxCardCount;
        i++
    ) {
        let item = createCardElement(data[i]);
        frag.appendChild(item);
    }

    let hasNextPage = pageIndex < totalPages - 1;

    return { frag: frag, hasNextPage: hasNextPage };
}

function getCard(name, size, img_src, figcaption, strength) {
    return `
        <a class="cardPreview ${size}" href="/card/${encodeURIComponent(name.replace(/ /g, "_"))}">
            <img loading="lazy" src="${img_src}?tr=n-gallery_${size == "icon-container" ? "s" : "l"}" alt=""/>
            <figcaption>${figcaption}</figcaption>
            ${strength}
        </a>
    `;
}

function getCardPlaceholder(size) {
    return `<a class='cardPreview ${size} placeholder'></a>`;
}

function createCardElement(card) {
    let template, img_src;
    let imageSize = "S",
        containerSize = "icon-container",
        viewtype = querystr.get("view");
    if (viewtype === "original" || viewtype === "bloomed") {
        imageSize = "L";
        containerSize = "full-container";
    }
    if (!card) {
        template = getCardPlaceholder(containerSize);
    } else {
        let bloomed = "";
        let figcaption =
            document.documentElement.lang === "ja" ? card.ja_name : card.name;
        let sortby = querystr.get("sortby");
        let strength = "";

        if (viewtype === "bloomed" && card.type === "Demon") {
            bloomed = "_b";
        }

        if (sortby && sortby.match(/^(min|max|fdt)_(-1|1)$/)) {
            strength = `<small>${card.total ? card.total.toLocaleString("en") : "???"}</small>`;
        }

        img_src = `/images/cards/${imageSize}/${card.uniqueName}${bloomed}.jpg`;
        template = getCard(
            card.name,
            containerSize,
            img_src,
            figcaption,
            strength
        );
    }

    let item = document.createElement("div");
    item.innerHTML = template.trim();

    if (selectionMode && card) {
        let cardNotSelected =
            cardSelectionChanged(card.uniqueName) == cardOwned(card.uniqueName);
        if (cardNotSelected) {
            $(item).find("img").addClass("notSelectedCard");
        }
    }

    return item.firstChild;
}

function applyFilters(e) {
    e.preventDefault();

    // update query string
    let params = getFilterQuery();
    if (params === undefined) return;

    querystr = new URLSearchParams(params.toString());
    updateURL();

    $("#demoncards>.ias, #memorycards>.ias").html(
        "<div class='spinner'>Loading...</div>"
    );
    $("#demoncards>p, #memorycards>p").addClass("d-none");

    // request cards
    getCards(params);
}

function getFilterQuery() {
    let filters = new FormData($("#filters form")[0]);
    let params = new URLSearchParams();

    for (let [key, value] of filters.entries()) {
        if (value) params.append(key, value);
    }

    if (params.get("cards") === "all") params.delete("cards");

    let search = $("input[name='search']").val();
    if (search) params.set("search", search);

    if (querystr.get("view")) params.set("view", querystr.get("view"));

    if (
        cardList.length > 0 &&
        params.toString() === document.location.search.substring(1)
    )
        return;

    return params;
}

function getCards(query) {
    query.set("path", PATH);
    if (PATH === "fav" || PATH === "collection") {
        query.set("user", window.location.pathname.split("/").at(-2));
    }
    $.ajax({
        type: "get",
        url: "/getCards?" + query.toString(),
        cache: false,
    }).done(function (data) {
        if (data.err) {
            showAlert("danger", "Something went wrong");
        }
        cardList = {
            demon: data.cards.filter((card) => card.type === "Demon"),
            memory: data.cards.filter((card) => card.type === "Memory"),
        };
        initInfiniteScroll();
        updateCardCount();
    });
}

function updateURL() {
    window.history.replaceState(
        null,
        "",
        `${window.location.pathname}?${querystr.toString()}`
    );
}

function updateViewType() {
    let currentView = querystr.get("view") ? querystr.get("view") : "icon";
    let newView = $(this).data("viewtype");
    if (newView === currentView) return;

    $("#viewMenuDropdown>button").text($(this).text());
    $(`a[data-viewtype=${currentView}]`).removeClass(
        "text-primary font-weight-bold"
    );
    $(this).addClass("text-primary font-weight-bold");

    querystr.set("view", $(this).data("viewtype"));

    initInfiniteScroll();
    updateURL();
}

function initInfiniteScroll() {
    unbindInfiniteScroll();

    if (cardList.demon.length !== 0) {
        nextHandler = function (pageIndex) {
            let result = createCardDocuments(cardList.demon, pageIndex);
            return this.append(Array.from(result.frag.childNodes)).then(
                () => result.hasNextPage
            );
        };
        ias = new InfiniteAjaxScroll("#demoncards>.ias", {
            item: ".cardPreview",
            next: nextHandler,
            logger: false,
            prefill: false,
            spinner: $("#demoncards>.spinner")[0],
        });
        ias.on("last", function () {
            for (let i = 0; i < 9; i++) {
                $("#demoncards>.ias").append(createCardElement());
            }
        });
        ias.next();
    } else {
        $("#demoncards>p").removeClass("d-none");
        $("#demoncards>.spinner").addClass("d-none");
    }

    if (cardList.memory.length !== 0) {
        nextHandler2 = function (pageIndex) {
            let result = createCardDocuments(cardList.memory, pageIndex);
            return this.append(Array.from(result.frag.childNodes)).then(
                () => result.hasNextPage
            );
        };
        ias2 = new InfiniteAjaxScroll("#memorycards>.ias", {
            item: ".cardPreview",
            next: nextHandler2,
            logger: false,
            prefill: false,
            spinner: $("#memorycards>.spinner")[0],
        });
        ias.on("last", function () {
            for (let i = 0; i < 9; i++) {
                $("#memorycards>.ias").append(createCardElement());
            }
        });
        ias2.next();
    } else {
        $("#memorycards>p").removeClass("d-none");
        $("#memorycards>.spinner").addClass("d-none");
    }
}

function unbindInfiniteScroll() {
    if (ias) ias = null;
    if (ias2) ias2 = null;
    $("#demoncards>.ias, #memorycards>.ias").html("");
}

function updateFilterParams() {
    const $this = $(this);
    const name = $this.attr("name");

    if (name === "cards") return;

    const isRadio = $this.attr("type") === "radio";
    const checkboxes = $(`input[name=${name}][type=checkbox]`);
    const checkedItems = checkboxes.filter(":checked");

    if (isRadio) {
        if (name == "characters") {
            $("#characters label.btn").removeClass("active");
        }
        checkedItems.prop("checked", false);
        return;
    }

    const allChecked = checkedItems.length === checkboxes.length;
    const noneChecked = checkedItems.length === 0;

    if (allChecked || noneChecked) {
        $(`input[name=${name}][type=radio]`).prop("checked", true);
        checkedItems.prop("checked", false);
        if (name == "characters") {
            $("#characters label.btn").removeClass("active");
        }
    } else {
        $(`input[name=${name}][type=radio]`).prop("checked", false);
    }
}

function resetFilters() {
    $("#filters input[type=radio]").prop("checked", true);
    $("#filters input[type=checkbox]").prop("checked", false);
    $("#checkCardsAll").prop("checked", true);
    $("#characters label.btn").removeClass("active");
    $("input[name='search']").val("");
    $("select[name='sortby']").val("").change();
}

function applyEffectWithoutTransition(elements, effect) {
    if (elements.length === 0) {
        return;
    }
    elements.addClass("no-transition");
    effect(elements);
    elements[0].offsetHeight;
    elements.removeClass("no-transition");
}

/* Collection Management */

function switchSelectionMode() {
    if (!selectionMode) {
        $.ajax({
            type: "get",
            url: "/collection/getOwnedCards",
            contentType: "application/json",
            cache: false,
        }).done(function (result) {
            if (result.err) {
                showAlert("danger", result.message);
                return;
            }
            ownedCards = result;
            selectionMode = true;
            switchManagementButtons();
            switchCardsVisualState(ownedCards);

            selectedCardCount.demon = cardList.demon.filter((x) =>
                cardOwned(x.uniqueName)
            ).length;
            selectedCardCount.memory = cardList.memory.filter((x) =>
                cardOwned(x.uniqueName)
            ).length;
            updateCardCount();
        });
    } else {
        if (Object.keys(changedCards).length > 0) {
            $.ajax({
                type: "post",
                url: "/collection/submitCollectionChanges",
                contentType: "application/json",
                data: JSON.stringify({
                    changedCards: changedCards,
                    collection: "owned",
                }),
                cache: false,
            }).done(function (result) {
                if (result.err) {
                    showAlert("danger", result.message);
                    return;
                }
                changedCards = {};
                selectionMode = false;
                switchManagementButtons();
                switchCardsVisualState();
                showAlert("success", "Collection updated!");

                updateCardCount();
            });
        } else {
            changedCards = {};
            selectionMode = false;
            switchManagementButtons();
            switchCardsVisualState();
        }

        updateCardCount();
    }
}

function switchManagementButtons() {
    if (selectionMode) {
        $("button#manageCollection").addClass("d-none");
        $("div#manageButtons").removeClass("d-none");
        $("div#selectionButtons").removeClass("d-none");
    } else {
        $("button#manageCollection").removeClass("d-none");
        $("div#manageButtons").addClass("d-none");
        $("div#selectionButtons").addClass("d-none");
    }
}

function switchCardsVisualState(cardNames = []) {
    let applyEffect;
    let cardPreviews;

    if (selectionMode) {
        let notOwnedCards = $('.cardPreview:not(".placeholder")')
            .filter(function () {
                return !cardNames.includes(
                    $("img", this).attr("src").split("/")[4].split(".jpg")[0]
                );
            })
            .toArray();
        cardPreviews = notOwnedCards.reduce(splitCardsByVisibility, {
            visible: [],
            invisible: [],
        });
        applyEffect = (el) => el.addClass("notSelectedCard");
    } else {
        cardPreviews = $(".cardPreview")
            .toArray()
            .reduce(splitCardsByVisibility, { visible: [], invisible: [] });
        applyEffect = (el) => el.removeClass("notSelectedCard");
    }

    cardPreviews.visible.forEach((card) => applyEffect(card));
    cardPreviews.invisible.forEach((card) =>
        applyEffectWithoutTransition($(card), applyEffect)
    );
}

function cardClicked(e) {
    if (!selectionMode) return;

    e.preventDefault();
    e.stopPropagation();

    let image = $(this).find("img");
    let cardName = $("img", this).attr("src").split("/")[4].split(".jpg")[0];

    updateChangedCards([cardName], $(image).hasClass("notSelectedCard"));
    $(image).toggleClass("notSelectedCard");

    updateCardCount();
}

function switchSelectionAll(select) {
    let cardsToSelect = getCardsToSelect(select);
    if (cardsToSelect.length == 0) return;

    let visibleCards = $('.cardPreview:visible:not(".placeholder")')
        .filter((idx, el) => $(el).isInViewport())
        .filter((idx, el) =>
            cardsToSelect.includes(
                $(el).find("img").attr("src").split("/")[4].split(".jpg")[0]
            )
        );

    let invisibleCards = $('.cardPreview:visible:not(".placeholder")')
        .filter((idx, el) => !$(el).isInViewport())
        .filter((idx, el) =>
            cardsToSelect.includes(
                $(el).find("img").attr("src").split("/")[4].split(".jpg")[0]
            )
        );

    let changeSelection;
    if (select) {
        changeSelection = (x) =>
            $(x).find("img").removeClass("notSelectedCard");
    } else {
        changeSelection = (x) => $(x).find("img").addClass("notSelectedCard");
    }

    updateChangedCards(cardsToSelect, select);
    changeSelection(visibleCards);
    applyEffectWithoutTransition(invisibleCards, () =>
        changeSelection(invisibleCards)
    );
    updateCardCount();
}

function updateChangedCards(cards, selected) {
    cards.forEach((uniqueName) => {
        changedCards[uniqueName] = selected;
        if (changedCards[uniqueName] === cardOwned(uniqueName)) {
            delete changedCards[uniqueName];
        }
    });
}

function getRowCapacity() {
    let cardsInRow;
    if (
        querystr.get("view") === "original" ||
        querystr.get("view") === "bloomed"
    ) {
        cardsInRow = { 576: 3, 768: 4, 992: 4, 1200: 4, xl: 5 };
    } else {
        cardsInRow = { 576: 4, 768: 6, 992: 7, 1200: 7, xl: 9 };
    }
    for (let [size, cardCount] of Object.entries(cardsInRow)) {
        if (size === "xl" || $(window).width() <= size) {
            return cardCount;
        }
    }
}

function getCardsToSelect(select) {
    let demonTabSelected = $("#demon-tab").hasClass("active");
    let cardsToSelect = demonTabSelected ? cardList.demon : cardList.memory;

    if (select) {
        cardsToSelect = cardsToSelect.filter(
            (x) => !cardOwned(x.uniqueName) || !changedCards[x.uniqueName]
        );
    } else {
        cardsToSelect = cardsToSelect.filter(
            (x) => cardOwned(x.uniqueName) || changedCards[x.uniqueName]
        );
    }

    return cardsToSelect.map((x) => x.uniqueName);
}

function updateCardCount() {
    totalCardCount.demon = cardList.demon.length;
    totalCardCount.memory = cardList.memory.length;
    selectedCardCount.demon = cardList.demon
        .filter(
            (x) =>
                (cardOwned(x.uniqueName) &&
                    !cardSelectionChanged(x.uniqueName)) ||
                changedCards[x.uniqueName]
        )
        .map((x) => x.uniqueName).length;
    selectedCardCount.memory = cardList.memory
        .filter(
            (x) =>
                (cardOwned(x.uniqueName) &&
                    !cardSelectionChanged(x.uniqueName)) ||
                changedCards[x.uniqueName]
        )
        .map((x) => x.uniqueName).length;

    if (selectionMode) {
        $("#demoncount").text(
            ` ${selectedCardCount.demon}/${totalCardCount.demon}`
        );
        $("#memorycount").text(
            ` ${selectedCardCount.memory}/${totalCardCount.memory}`
        );
    } else {
        $("#demoncount").text(` ${totalCardCount.demon}`);
        $("#memorycount").text(` ${totalCardCount.memory}`);
    }
}
