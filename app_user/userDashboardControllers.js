module.exports.home = (req, res) => {
    const data = {
        layout: "userBase",
        card: "bg-neutral-4",
        styles: ["/style/userCardList.css"],
        scripts: ["/js/user/cardList.js"],
        pageTitle: "This is your card list",
        pageType: "card",
    };
    res.render("user/user", data);
};

module.exports.cardLogs = async (req, res) => {
    const { id } = req.params;
    const data = {
        layout: "userBase",
        card: "bg-neutral-4",
        styles: ["/style/userCardLogs.css"],
        scripts: ["/js/user/cardLogs.js"],
        id,
    };
    res.render("user/userCardLogs", data);
};

module.exports.cardChangePin = (req, res) => {
    const { id } = req.params;
    const data = {
        layout: "userBase",
        card: "bg-neutral-4",
        styles: ["/style/changePin.css"],
        scripts: ["/js/user/cardChangePin.js"],
        id,
    };
    res.render("user/userChangePin", data);
};

module.exports.cardRoom = (req, res) => {
    const { card: id } = req.params;
    const data = {
        layout: "userBase",
        card: "bg-neutral-4",
        styles: [
            "/style/userCardLogs.css",
            "/style/buildingList.css",
            "/style/api.css",
            "/style/userCardRoom.css",
        ],
        scripts: ["/js/user/cardRoomScrolhandler.js", "/js/user/cardRoom.js"],
        id,
    };
    res.render("user/userCardRoom", data);
};

module.exports.myFaceList = (req, res) => {
    const data = {
        layout: "userBase",
        faceMenu: "bg-neutral-4",
        styles: ["/style/userCardList.css"],
        scripts: ["/js/user/faceList.js"],
        pageTitle: "This is your face list",
        pageType: "face",
    };
    res.render("user/user", data);
};

module.exports.myFaceDetail = (req, res) => {
    const { faceId } = req.params;
    const data = {
        layout: "userBase",
        faceMenu: "bg-neutral-4",
        styles: ["/style/userCardLogs.css"],
        scripts: ["/js/user/faceLogs.js"],
        id: faceId,
    };
    res.render("user/userFaceLogs", data);
};

module.exports.faceRoom = (req, res) => {
    const { faceId } = req.params;
    const data = {
        layout: "userBase",
        faceMenu: "bg-neutral-4",
        styles: [
            "/style/userCardLogs.css",
            "/style/buildingList.css",
            "/style/api.css",
            "/style/userCardRoom.css",
        ],
        scripts: ["/js/user/cardRoomScrolhandler.js", "/js/user/faceRoom.js"],
        id: faceId,
    };

    res.render("user/userFaceRoom", data);
};