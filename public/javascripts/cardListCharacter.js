const { createApp } = Vue;
createApp({
    data: () => ({
        source: "",
        rarity: "",
        attribute: "",
        cards: {
            demon: [],
            memory: [],
        },
        loading: false,
    }),
    created() {
        this.fetchData();
    },
    methods: {
        async fetchData() {
            this.loading = true;

            let url = "/getCards2?characters=" + character;
            if (this.source) url += "&source=" + this.source;
            if (this.rarity) url += "&rarity=" + this.rarity;
            if (this.attribute) url += "&attribute=" + this.attribute;

            let cards = (await (await fetch(url)).json()).cards;
            this.cards.demon = cards.filter((x) => x.type === "Demon");
            this.cards.memory = cards.filter((x) => x.type === "Memory");

            this.loading = false;
        },
    },
}).mount("#app");
