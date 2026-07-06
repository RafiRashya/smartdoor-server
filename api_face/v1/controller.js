const fs = require("fs");
const path = require("path");
const prisma = require("../../prisma/client");
const { resError, resSuccess } = require("../../services/responseHandler");
const { RabbitConnection } = require("../../connection/amqp");
const { getUser } = require("../../services/auth");

const FACE_STORAGE_DIR = path.join(__dirname, "..", "..", "public", "storage", "face");

const ensureFaceStorageDir = () => {
    fs.mkdirSync(FACE_STORAGE_DIR, { recursive: true });
};

const getPrimaryCardForUser = async (userId) => {
    return prisma.card.findFirst({
        where: {
            userId,
        },
        orderBy: {
            createdAt: "asc",
        },
        select: {
            id: true,
            card_number: true,
            card_name: true,
            type: true,
            isTwoStepAuth: true,
            banned: true,
        },
    });
};

const normalizeRoomIds = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return [];
        if (trimmed.startsWith("[")) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed.filter(Boolean);
            } catch (error) {
                return trimmed
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean);
            }
        }
        return trimmed
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    }
    return [];
};

const extractRoomNodeIds = (roomAccess = []) => {
    const roomNodeIds = new Set();

    for (const access of roomAccess) {
        const deviceId = access?.room?.device?.device_id;
        if (deviceId) {
            roomNodeIds.add(deviceId);
        }
    }

    return Array.from(roomNodeIds);
};

const parseJsonValue = (value) => {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") return value;

    try {
        return JSON.parse(value);
    } catch (error) {
        return null;
    }
};

const parseNumberValue = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
};

const buildFaceSelect = {
    id: true,
    userId: true,
    label: true,
    imagePath: true,
    embedding: true,
    embeddingVersion: true,
    captureQuality: true,
    sourceGatewayShortId: true,
    status: true,
    syncedAt: true,
    createdAt: true,
    updatedAt: true,
    user: {
        select: {
            id: true,
            username: true,
            email: true,
            profil: {
                select: {
                    full_name: true,
                    photo: true,
                },
            },
        },
    },
    roomAccess: {
        select: {
            id: true,
            roomId: true,
            room: {
                select: {
                    id: true,
                    ruid: true,
                    name: true,
                    device: { select: { device_id: true } },
                },
            },
        },
    },
};

const buildFacePayload = async (face) => {
    if (!face) return face;
    return {
        ...face,
        roomIds: face.roomAccess.map((item) => item.roomId),
    };
};

const averageEmbeddings = (embeddings) => {
    const validEmbeddings = embeddings.filter((embedding) => Array.isArray(embedding) && embedding.length > 0);
    if (!validEmbeddings.length) return null;

    const dimension = validEmbeddings[0].length;
    const totals = new Array(dimension).fill(0);

    for (const embedding of validEmbeddings) {
        for (let index = 0; index < dimension; index += 1) {
            totals[index] += Number(embedding[index] || 0);
        }
    }

    return totals.map((total) => total / validEmbeddings.length);
};

const getGatewayFaceSyncRows = async (gatewayShortId) => {
    const faces = await prisma.face.findMany({
        where: {
            status: "ACTIVE",
            userId: {
                not: null,
            },
            roomAccess: {
                some: {
                    room: {
                        device: {
                            Gateway_Spot: {
                                gatewayDevice: {
                                    gateway_short_id: gatewayShortId,
                                },
                            },
                        },
                    },
                },
            },
        },
        select: {
            id: true,
            label: true,
            embedding: true,
            userId: true,
            user: {
                select: {
                    id: true,
                    username: true,
                    profil: {
                        select: {
                            full_name: true,
                        },
                    },
                },
            },
            roomAccess: {
                select: {
                    room: {
                        select: {
                            id: true,
                            name: true,
                            device: {
                                select: {
                                    device_id: true,
                                },
                            },
                        },
                    },
                },
            },
        },
        orderBy: {
            updatedAt: "desc",
        },
    });

    const groupedByUser = new Map();

    for (const face of faces) {
        if (!face.userId || !Array.isArray(face.embedding)) continue;

        const existing = groupedByUser.get(face.userId) || {
            userId: face.userId,
            username: face.user?.username || face.label || face.user?.profil?.full_name || face.userId,
            fullName: face.user?.profil?.full_name || face.user?.username || face.label || face.userId,
            embeddings: [],
            roomNodeIds: new Set(),
            faceIds: [],
        };

        existing.embeddings.push(face.embedding);
        existing.faceIds.push(face.id);

        for (const roomAccess of face.roomAccess) {
            const nodeId = roomAccess.room?.device?.device_id;
            if (nodeId) {
                existing.roomNodeIds.add(nodeId);
            }
        }

        groupedByUser.set(face.userId, existing);
    }

    return Array.from(groupedByUser.values()).map((item) => ({
        userId: item.userId,
        username: item.username,
        fullName: item.fullName,
        faceIds: item.faceIds,
        faceEmbedding: averageEmbeddings(item.embeddings),
        roomNodeIds: Array.from(item.roomNodeIds),
    })).filter((item) => item.faceEmbedding !== null);
};

const publishFaceToGateway = async (type, gatewayShortId, face, additionalPayload = {}) => {
    try {
        if (!gatewayShortId) return;

        const bindingKey = `${type}face/${gatewayShortId}/gateway`;

        let finalEmbedding = Array.isArray(face.embedding) ? face.embedding : face.embedding || null;
        if (face.userId && type !== "removeface") {
            const allActiveUserFaces = await prisma.face.findMany({
                where: {
                    userId: face.userId,
                    status: "ACTIVE",
                    roomAccess: {
                        some: {
                            room: {
                                device: {
                                    Gateway_Spot: {
                                        gatewayDevice: {
                                            gateway_short_id: gatewayShortId,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                select: {
                    embedding: true,
                },
            });
            const embeddingsList = allActiveUserFaces
                .map(f => f.embedding)
                .filter(emb => Array.isArray(emb) && emb.length > 0);
            if (embeddingsList.length > 0) {
                finalEmbedding = averageEmbeddings(embeddingsList);
            }
        }

        const payload = {
            userId: face.userId || null,
            fullName: face.user?.profil?.full_name || face.user?.username || face.label || null,
            faceEmbedding: finalEmbedding,
            roomNodeIds: extractRoomNodeIds(face.roomAccess || []),
            createdAt: new Date().toISOString(),
            ...additionalPayload,
        };

        await RabbitConnection.sendMessage(JSON.stringify(payload), bindingKey);
    } catch (err) {
        console.error("AMQP publishFaceToGateway failed", err);
    }
};

exports.enroll = async (req, res) => {
    try {
        const { gatewayShortId, label, username, embeddingVersion } = req.body;
        const roomIds = normalizeRoomIds(req.body.roomIds);

        if (!gatewayShortId) {
            return resError({ res, title: "Gateway short id is required" });
        }

        if (!req.file) {
            return resError({ res, title: "Face image is required" });
        }

        ensureFaceStorageDir();

        const imagePath = `/storage/face/${req.file.filename}`;
        const captureQuality = parseNumberValue(req.body.captureQuality);
        const embedding = parseJsonValue(req.body.embedding);

        let matchedUser = null;

        if (username) {
            matchedUser = await prisma.user.findFirst({
                where: {
                    username: {
                        equals: username,
                        mode: "insensitive",
                    },
                },
                select: {
                    id: true,
                    username: true,
                    profil: {
                        select: {
                            full_name: true,
                            photo: true,
                        },
                    },
                },
            });

            if (!matchedUser) {
                return resError({
                    res,
                    title: "User not found",
                    code: 404,
                    errors: `Username ${username} not found`,
                });
            }
        }

        const face = await prisma.face.create({
            data: {
                label: label || matchedUser?.profil?.full_name || matchedUser?.username || username || null,
                imagePath,
                embedding,
                embeddingVersion: embeddingVersion || null,
                captureQuality,
                sourceGatewayShortId: gatewayShortId,
                status: matchedUser ? "ACTIVE" : "PENDING",
                user: matchedUser ? { connect: { id: matchedUser.id } } : undefined,
                roomAccess: roomIds.length
                    ? {
                          create: roomIds.map((roomId) => ({
                              room: { connect: { id: roomId } },
                          })),
                      }
                    : undefined,
            },
            select: buildFaceSelect,
        });

        const additionalPayload = {};
        if (req.body.sendTimestamp) additionalPayload.sendTimestamp = Number(req.body.sendTimestamp);
        if (req.body.senderOffset) additionalPayload.senderOffset = Number(req.body.senderOffset);

        try {
            await publishFaceToGateway("add", gatewayShortId, face, additionalPayload);
        } catch (e) {
            console.error("publish enqueue error", e);
        }

        return resSuccess({
            res,
            title: "Success enroll face",
            data: await buildFacePayload(face),
        });
    } catch (error) {
        return resError({ res, title: "Failed enroll face", errors: error });
    }
};

exports.list = async (req, res) => {
    try {
        const { search, status, userId, roomId } = req.query;
        const take = Number(req.query.limit) || 10;

        const andConditions = [];

        if (search) {
            andConditions.push({
                OR: [
                    { label: { contains: search, mode: "insensitive" } },
                    { sourceGatewayShortId: { contains: search, mode: "insensitive" } },
                    {
                        user: {
                            username: { contains: search, mode: "insensitive" },
                        },
                    },
                ],
            });
        }

        if (status) andConditions.push({ status });
        if (userId) andConditions.push({ userId });
        if (roomId) {
            andConditions.push({
                roomAccess: {
                    some: {
                        roomId,
                    },
                },
            });
        }

        const data = await prisma.face.findMany({
            where: andConditions.length ? { AND: andConditions } : undefined,
            take,
            orderBy: { createdAt: "desc" },
            select: buildFaceSelect,
        });

        return resSuccess({
            res,
            title: "Success get face list",
            data: await Promise.all(data.map(buildFacePayload)),
        });
    } catch (error) {
        return resError({ res, title: "Failed get face list", errors: error });
    }
};

exports.detail = async (req, res) => {
    try {
        const { id } = req.params;
        const face = await prisma.face.findUnique({
            where: { id },
            select: buildFaceSelect,
        });

        if (!face) {
            return resError({ res, title: "Face not found", code: 404 });
        }

        return resSuccess({
            res,
            title: "Success get face detail",
            data: await buildFacePayload(face),
        });
    } catch (error) {
        return resError({ res, title: "Failed get face detail", errors: error });
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const face = await prisma.face.findUnique({ where: { id } });

        if (!face) {
            return resError({ res, title: "Face not found", code: 404 });
        }

        const updatedFace = await prisma.face.update({
            where: { id },
            data: {
                label: req.body.label !== undefined ? req.body.label : undefined,
                status: req.body.status || undefined,
                embedding: req.body.embedding !== undefined ? parseJsonValue(req.body.embedding) : undefined,
                embeddingVersion: req.body.embeddingVersion || undefined,
                captureQuality: req.body.captureQuality !== undefined ? parseNumberValue(req.body.captureQuality) : undefined,
                sourceGatewayShortId: req.body.gatewayShortId || undefined,
                imagePath: req.file ? `/storage/face/${req.file.filename}` : undefined,
            },
            select: buildFaceSelect,
        });

        const additionalPayload = {};
        if (req.body.sendTimestamp) additionalPayload.sendTimestamp = Number(req.body.sendTimestamp);
        if (req.body.senderOffset) additionalPayload.senderOffset = Number(req.body.senderOffset);

        try {
            const gwShort = updatedFace.sourceGatewayShortId || null;
            await publishFaceToGateway("update", gwShort, updatedFace, additionalPayload);
        } catch (e) {
            console.error("publish enqueue error", e);
        }

        return resSuccess({
            res,
            title: "Success update face",
            data: await buildFacePayload(updatedFace),
        });
    } catch (error) {
        return resError({ res, title: "Failed update face", errors: error });
    }
};

exports.linkUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;

        const updatedFace = await prisma.face.update({
            where: { id },
            data: {
                user: { connect: { id: userId } },
                status: "ACTIVE",
            },
            select: buildFaceSelect,
        });

        try {
            const gwShort = updatedFace.sourceGatewayShortId || null;
            await publishFaceToGateway("update", gwShort, updatedFace);
        } catch (e) {
            console.error("publish enqueue error", e);
        }

        return resSuccess({
            res,
            title: "Success link face to user",
            data: await buildFacePayload(updatedFace),
        });
    } catch (error) {
        return resError({ res, title: "Failed link face to user", errors: error });
    }
};

exports.setAccess = async (req, res) => {
    try {
        const { id } = req.params;
        const roomIds = normalizeRoomIds(req.body.roomIds);

        const face = await prisma.face.findUnique({ where: { id } });
        if (!face) {
            return resError({ res, title: "Face not found", code: 404 });
        }

        await prisma.faceRoomAccess.deleteMany({ where: { faceId: id } });

        if (roomIds.length) {
            await prisma.faceRoomAccess.createMany({
                data: roomIds.map((roomId) => ({
                    faceId: id,
                    roomId,
                })),
                skipDuplicates: true,
            });
        }

        const updatedFace = await prisma.face.findUnique({
            where: { id },
            select: buildFaceSelect,
        });

        try {
            const gwShort = updatedFace.sourceGatewayShortId || null;
            await publishFaceToGateway("update", updatedFace.sourceGatewayShortId, updatedFace);
        } catch (e) {
            console.error("publish enqueue error", e);
        }

        return resSuccess({
            res,
            title: "Success update face access",
            data: await buildFacePayload(updatedFace),
        });
    } catch (error) {
        return resError({ res, title: "Failed update face access", errors: error });
    }
};

exports.sync = async (req, res) => {
    try {
        const { id } = req.params;
        const face = await prisma.face.findUnique({
            where: { id },
            select: buildFaceSelect,
        });

        if (!face) {
            return resError({ res, title: "Face not found", code: 404 });
        }

        const updatedFace = await prisma.face.update({
            where: { id },
            data: {
                syncedAt: new Date(),
            },
            select: buildFaceSelect,
        });

        return resSuccess({
            res,
            title: "Success get face sync payload",
            data: await buildFacePayload(updatedFace),
        });
    } catch (error) {
        return resError({ res, title: "Failed sync face", errors: error });
    }
};

exports.syncForGateway = async (req, res) => {
    try {
        const { gatewayShortId } = req.params;

        if (!gatewayShortId) {
            return resError({ res, title: "Gateway short id is required" });
        }

        const data = await getGatewayFaceSyncRows(gatewayShortId);

        return resSuccess({
            res,
            title: "Success get face sync data",
            data: {
                gatewayShortId,
                users: data,
                syncedAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        return resError({ res, title: "Failed get face sync data", errors: error });
    }
};

exports.userList = async (req, res) => {
    try {
        const userId = getUser(req);
        const { search, cursor } = req.query;
        const take = Number(req.query.limit) || 10;

        const andConditions = [{ userId }];

        if (search) {
            andConditions.push({
                OR: [
                    { label: { contains: search, mode: "insensitive" } },
                    { sourceGatewayShortId: { contains: search, mode: "insensitive" } },
                ],
            });
        }

        const data = await prisma.face.findMany({
            where: { AND: andConditions },
            take,
            orderBy: { createdAt: "desc" },
            ...(cursor
                ? {
                      skip: 1,
                      cursor: { id: cursor },
                  }
                : {}),
            select: buildFaceSelect,
        });

        return resSuccess({
            res,
            title: "Success get user face list",
            data: await Promise.all(data.map(buildFacePayload)),
        });
    } catch (error) {
        return resError({ res, title: "Failed get user face list", errors: error });
    }
};

exports.userDetail = async (req, res) => {
    try {
        const userId = getUser(req);
        const { faceId } = req.params;

        const face = await prisma.face.findFirst({
            where: {
                id: faceId,
                userId,
            },
            select: buildFaceSelect,
        });

        if (!face) {
            return resError({ res, title: "Face not found", code: 404 });
        }

        const primaryCard = await getPrimaryCardForUser(userId);

        return resSuccess({
            res,
            title: "Success get user face detail",
            data: {
                ...(await buildFacePayload(face)),
                primaryCard,
            },
        });
    } catch (error) {
        return resError({ res, title: "Failed get user face detail", errors: error });
    }
};

exports.userRoom = async (req, res) => {
    try {
        const userId = getUser(req);
        const { faceId } = req.params;

        const face = await prisma.face.findFirst({
            where: {
                id: faceId,
                userId,
            },
            select: {
                id: true,
                label: true,
                status: true,
                roomAccess: {
                    select: {
                        room: {
                            select: {
                                id: true,
                                ruid: true,
                                name: true,
                                device: {
                                    select: {
                                        device_id: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!face) {
            return resError({ res, title: "Face not found", code: 404 });
        }

        return resSuccess({
            res,
            title: "Success get user face room access",
            data: {
                faceId: face.id,
                label: face.label,
                status: face.status,
                rooms: face.roomAccess.map((item) => item.room),
            },
        });
    } catch (error) {
        return resError({ res, title: "Failed get user face room access", errors: error });
    }
};

exports.userLogs = async (req, res) => {
    try {
        const userId = getUser(req);
        const { cursor } = req.query;
        const take = Number(req.query.limit) || 10;

        const logs = await prisma.rooms_Records.findMany({
            where: {
                Card: {
                    userId,
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            take,
            ...(cursor
                ? {
                      skip: 1,
                      cursor: { id: cursor },
                  }
                : {}),
            select: {
                id: true,
                createdAt: true,
                isSuccess: true,
                room: {
                    select: {
                        name: true,
                        ruid: true,
                    },
                },
                Card: {
                    select: {
                        card_name: true,
                        card_number: true,
                    },
                },
            },
        });

        return resSuccess({
            res,
            title: "Success get user face logs",
            data: logs,
        });
    } catch (error) {
        return resError({ res, title: "Failed get user face logs", errors: error });
    }
};

exports.userUpdateFace = async (req, res) => {
    try {
        const userId = getUser(req);
        const { faceId } = req.params;
        const { label, status } = req.body;

        const face = await prisma.face.findFirst({
            where: {
                id: faceId,
                userId,
            },
        });

        if (!face) {
            return resError({ res, title: "Face not found", code: 404 });
        }

        const updatedFace = await prisma.face.update({
            where: { id: faceId },
            data: {
                label: label !== undefined ? label : undefined,
                status: status || undefined,
            },
            select: buildFaceSelect,
        });

        return resSuccess({
            res,
            title: "Success update user face",
            data: await buildFacePayload(updatedFace),
        });
    } catch (error) {
        return resError({ res, title: "Failed update user face", errors: error });
    }
};

exports.userRequestRoom = async (req, res) => {
    try {
        const userId = getUser(req);
        const { faceId, ruid } = req.body;

        const face = await prisma.face.findFirst({
            where: {
                id: faceId,
                userId,
            },
        });

        if (!face) {
            return resError({ res, title: "Face not found", code: 404 });
        }

        const room = await prisma.room.findUnique({
            where: { ruid },
            select: {
                id: true,
                ruid: true,
                name: true,
            },
        });

        if (!room) {
            return resError({ res, title: "Room not found", code: 404 });
        }

        const existedRequest = await prisma.face_Request.findFirst({
            where: {
                faceId: face.id,
                roomId: room.id,
            },
        });

        if (existedRequest) {
            return resSuccess({
                res,
                title: "Room access already requested",
                data: existedRequest,
            });
        }

        const request = await prisma.face_Request.create({
            data: {
                face: { connect: { id: face.id } },
                room: { connect: { id: room.id } },
                status: "PENDING",
            },
            select: {
                id: true,
                faceId: true,
                roomId: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                room: {
                    select: {
                        id: true,
                        ruid: true,
                        name: true,
                    },
                },
            },
        });

        return resSuccess({
            res,
            title: "Success request room access",
            data: request,
        });
    } catch (error) {
        return resError({ res, title: "Failed request room access", errors: error });
    }
};

exports.remove = async (req, res) => {
    try {
        const { id } = req.params;
        const face = await prisma.face.findUnique({ where: { id } });

        if (!face) {
            return resError({ res, title: "Face not found", code: 404 });
        }

        const filePath = path.join(__dirname, "..", "..", "public", face.imagePath.replace(/^\//, ""));
        
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (fileErr) {
            console.error("Failed to delete physical face file:", fileErr);
        }

        await prisma.face.delete({ where: { id } });

        try {
            if (face.userId) {
                const activeFaces = await prisma.face.findMany({
                    where: {
                        userId: face.userId,
                        status: "ACTIVE",
                    },
                    select: {
                        embedding: true,
                        roomAccess: {
                            select: {
                                room: {
                                    select: {
                                        device: { select: { device_id: true } }
                                    }
                                }
                            }
                        }
                    },
                });

                const additionalPayload = {};
                if (req.query.sendTimestamp) additionalPayload.sendTimestamp = Number(req.query.sendTimestamp);
                if (req.query.senderOffset) additionalPayload.senderOffset = Number(req.query.senderOffset);

                if (activeFaces.length > 0) {
                    const embeddingsList = activeFaces
                        .map(f => f.embedding)
                        .filter(emb => Array.isArray(emb) && emb.length > 0);
                    const avgEmbedding = averageEmbeddings(embeddingsList);

                    const user = await prisma.user.findUnique({
                        where: { id: face.userId },
                        include: { profil: true },
                    });

                    const roomNodeIds = new Set();
                    for (const f of activeFaces) {
                        const nodes = extractRoomNodeIds(f.roomAccess || []);
                        for (const node of nodes) {
                            roomNodeIds.add(node);
                        }
                    }

                    const payload = {
                        userId: face.userId,
                        fullName: user?.profil?.full_name || user?.username || face.label || null,
                        faceEmbedding: avgEmbedding,
                        roomNodeIds: Array.from(roomNodeIds),
                        createdAt: new Date().toISOString(),
                        ...additionalPayload,
                    };

                    await RabbitConnection.sendMessage(
                        JSON.stringify(payload),
                        `updateface/${face.sourceGatewayShortId || 'all'}/gateway`
                    );
                } else {
                    const payload = { 
                        userId: face.userId, 
                        createdAt: new Date().toISOString(),
                        ...additionalPayload,
                    };
                    await RabbitConnection.sendMessage(
                        JSON.stringify(payload),
                        `removeface/${face.sourceGatewayShortId || 'all'}/gateway`
                    );
                }
            }
        } catch (err) {
            console.error("AMQP remove publish failed", err);
        }

        return resSuccess({
            res,
            title: "Success delete face",
            data: { id },
        });
    } catch (error) {
        return resError({ res, title: "Failed delete face", errors: error });
    }
};

exports.userRequestList = async (req, res) => {
    try {
        const userId = getUser(req);

        const faces = await prisma.face.findMany({
            where: { userId },
            select: {
                id: true,
                label: true,
                status: true,
                roomAccess: {
                    select: {
                        room: {
                            select: {
                                id: true,
                                ruid: true,
                                name: true,
                            },
                        },
                    },
                },
                faceRequests: {
                    select: {
                        id: true,
                        roomId: true,
                        status: true,
                        room: {
                            select: {
                                id: true,
                                ruid: true,
                                name: true,
                            },
                        },
                    },
                },
            },
        });

        return resSuccess({
            res,
            title: "Success get face request list",
            data: faces,
        });
    } catch (error) {
        return resError({ res, title: "Failed get face request list", errors: error });
    }
};

exports.adminFaceRequestList = async (req, res) => {
    try {
        const { ruid } = req.params;
        const { cursor } = req.query;
        const take = Number(req.query.limit) || 10;

        if (!ruid) {
            return resError({ res, title: "Room id is required", code: 400 });
        }

        const requests = await prisma.face_Request.findMany({
            where: {
                room: {
                    is: {
                        ruid,
                    },
                },
            },
            orderBy: {
                createdAt: "asc",
            },
            take,
            ...(cursor
                ? {
                      skip: 1,
                      cursor: { id: cursor },
                  }
                : {}),
            select: {
                id: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                face: {
                    select: {
                        id: true,
                        label: true,
                        imagePath: true,
                        status: true,
                        user: {
                            select: {
                                id: true,
                                username: true,
                                profil: {
                                    select: {
                                        full_name: true,
                                        photo: true,
                                    },
                                },
                            },
                        },
                    },
                },
                room: {
                    select: {
                        id: true,
                        ruid: true,
                        name: true,
                    },
                },
            },
        });

        return resSuccess({
            res,
            title: "Success get face request list",
            data: requests,
        });
    } catch (error) {
        console.error("adminFaceRequestList error:", error);
        return resError({ res, title: "Failed get face request list", errors: error });
    }
};