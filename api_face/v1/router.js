const express = require("express");
const multer = require("multer");
const fs = require("fs");
const { body, param } = require("express-validator");
const { formChacker } = require("../../middlewares/formMiddleware");
const { loginRequired, allowedRole } = require("../../middlewares/authMiddlewares");
const { apiJWTValidation } = require("../../middlewares/apiKeyMiddlewares");
const face = require("./controller");

const router = express.Router();
const FACE_STORAGE_DIR = "./public/storage/face";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        fs.mkdirSync(FACE_STORAGE_DIR, { recursive: true });
        cb(null, FACE_STORAGE_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const extArray = file.mimetype.split("/");
        const extension = extArray[extArray.length - 1];
        cb(
            null,
            `${file.fieldname}-${String(file.originalname)
                .split(".")[0]
                .replaceAll(" ", "-")}-${uniqueSuffix}.${extension}`
        );
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5000000,
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(png|jpg|jpeg|PNG|JPG|JPEG)$/)) {
            return cb(new Error("Please upload an image"));
        }
        cb(undefined, true);
    },
});

router.post(
    "/h/enroll",
    apiJWTValidation,
    upload.single("image"),
    body("gatewayShortId").notEmpty().withMessage("Gateway short id is required"),
    formChacker,
    face.enroll
);

router.get(
    "/",
    loginRequired,
    allowedRole("ADMIN", "OPERATOR"),
    face.list
);

router.get(
    "/:id",
    loginRequired,
    allowedRole("ADMIN", "OPERATOR"),
    param("id").notEmpty(),
    formChacker,
    face.detail
);

router.patch(
    "/:id",
    loginRequired,
    allowedRole("ADMIN", "OPERATOR"),
    upload.single("image"),
    param("id").notEmpty(),
    formChacker,
    face.update
);

router.post(
    "/:id/link-user",
    loginRequired,
    allowedRole("ADMIN", "OPERATOR"),
    body("userId").notEmpty().withMessage("User id is required"),
    param("id").notEmpty(),
    formChacker,
    face.linkUser
);

router.post(
    "/:id/access",
    loginRequired,
    allowedRole("ADMIN", "OPERATOR"),
    param("id").notEmpty(),
    formChacker,
    face.setAccess
);

router.post(
    "/:id/sync",
    loginRequired,
    allowedRole("ADMIN", "OPERATOR"),
    param("id").notEmpty(),
    formChacker,
    face.sync
);

router.get(
    "/h/sync/:gatewayShortId",
    apiJWTValidation,
    param("gatewayShortId").notEmpty().withMessage("Gateway short id is required"),
    formChacker,
    face.syncForGateway
);

router.delete(
    "/:id",
    loginRequired,
    allowedRole("ADMIN", "OPERATOR"),
    param("id").notEmpty(),
    formChacker,
    face.remove
);

router.get(
    "/u/list",
    loginRequired,
    allowedRole("USER"),
    face.userList
);

router.get(
    "/u/:faceId",
    loginRequired,
    allowedRole("USER"),
    param("faceId").notEmpty(),
    formChacker,
    face.userDetail
);

router.get(
    "/u/room/accesable/:faceId",
    loginRequired,
    allowedRole("USER"),
    param("faceId").notEmpty(),
    formChacker,
    face.userRoom
);

router.get(
    "/u/logs/:faceId",
    loginRequired,
    allowedRole("USER"),
    param("faceId").notEmpty(),
    formChacker,
    face.userLogs
);

router.patch(
    "/u/:faceId",
    loginRequired,
    allowedRole("USER"),
    param("faceId").notEmpty(),
    formChacker,
    face.userUpdateFace
);

router.post(
    "/u/request",
    loginRequired,
    allowedRole("USER"),
    body("faceId").notEmpty(),
    body("ruid").notEmpty(),
    formChacker,
    face.userRequestRoom
);

router.get(
    "/request-face/:ruid",
    loginRequired,
    allowedRole("ADMIN", "ADMIN TEKNIS", "OPERATOR"),
    face.adminFaceRequestList
);

module.exports = router;