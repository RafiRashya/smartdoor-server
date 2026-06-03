const express = require("express");
const router = express.Router();
const user = require("./userDashboardControllers");
const {
    loginRequired,
    allowedRole,
    accountIsVerified,
} = require("../middlewares/uiMiddlewares");

router.use(loginRequired, accountIsVerified); //memastikan user yang sudah aktif yang bisa menggunakan seluruh fitur

// Rute Bawaan
router.get("/", allowedRole("USER"), user.home);
router.get("/card/:id", allowedRole("USER"), user.cardLogs);
router.get("/card/change-pin/:id", allowedRole("USER"), user.cardChangePin);
router.get("/room/:card", allowedRole("USER"), user.cardRoom);

// ==========================================
// RUTE BARU: FACE ACCESS (USER)
// ==========================================
router.get("/face/list", allowedRole("USER"), user.myFaceList);
router.get("/face/detail/:faceId", allowedRole("USER"), user.myFaceDetail);
router.get("/face/room/:faceId", allowedRole("USER"), user.faceRoom);

module.exports = router;