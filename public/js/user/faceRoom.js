document.addEventListener("DOMContentLoaded", () => {
    const faceIdContainer = document.querySelector(".card-number");
    const faceId = faceIdContainer?.getAttribute("data-id");
    const faceIcon = document.querySelector(".card-icon");
    const roomContainer = document.querySelector(".request-room");
    const buildingContainer = document.querySelector(".building-container");
    const accessableRoomContainer = document.querySelector(".accessable-table-container");
    const loadMoreRoomList = document.querySelector("#load-more");
    const loadMoreBuildingList = document.querySelector("#loadMoreBuilding");
    const loadMoreAccessableRoom = document.querySelector("#load-more-accessable-room");
    const searchValue = document.querySelector("#searchForm");
    const searchBtn = document.querySelector("#searchBtn");

    if (!faceId || !roomContainer || !buildingContainer || !accessableRoomContainer) return;

    let buildingId = "all";
    let roomCursor = null;
    let buildingCursor = null;
    let accessCursor = null;

    const escapeHtml = (value) => {
        if (value === null || value === undefined) return "";
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    };

    const roomRequestTemplate = ({ room: { ruid, name, id }, no }) => {
        return `
        <div class="table-row d-flex align-items-center py-1 py-md-2 justify-content-between px-3 hardware--list-item" id="room-${escapeHtml(id)}" data-id="${escapeHtml(id)}" data-ruid="${escapeHtml(ruid)}">
            <span class="table-data align-middle text-center text-neutral-2">${no}</span>
            <p class="table-data text-center text-neutral-2">${escapeHtml(ruid)}</p>
            <p class="table-data text-center text-neutral-2">${escapeHtml(name || "-")}</p>
            <span class="table-data text-center align-bottom text-blue-4 fw-bold pointer bg-blue-2 py-1 rounded-13 choose" onclick="requestRoom('${escapeHtml(id)}')">
                Request
            </span>
        </div>
        `;
    };

    const accessableRoomTemplate = ({ ruid, name, id }) => {
        return `
        <div class="row bg-neutral-7 p-2 rounded-10 mt-2 accessables-room" data-accessable-room="${escapeHtml(id)}">
            <div class="col-6">
                <p class="text-center text-neutral-2">${escapeHtml(ruid)}</p>
            </div>
            <div class="col-6">
                <p class="text-center text-neutral-2">${escapeHtml(name || "-")}</p>
            </div>
        </div>
        `;
    };

    const buildingDataTemplate = (building) => {
        return `
            <p class="building-list-item px-4 py-1 rounded-10 fw-bold text-neutral-7 bg-blue-3 me-2 mb-0 pointer" id="building-${escapeHtml(building.id)}" data-id="${escapeHtml(building.id)}" onclick="buildingSelectorHandler('${escapeHtml(building.id)}')">
                ${escapeHtml(building.name)}
            </p>
        `;
    };

    const setHeader = async () => {
        const resp = await fetch(`/api/v1/face/u/${faceId}`, {
            headers: { Accept: "application/json" },
        });

        const json = await resp.json().catch(() => null);
        if (!resp.ok || !json?.success) {
            if (typeof showToast === "function") {
                showToast({
                    theme: "danger",
                    title: "Failed load face info",
                    desc: json?.message || `HTTP ${resp.status}`,
                });
            }
            return;
        }

        const face = json.data || {};
        faceIdContainer.textContent = `${face.label || face.user?.username || "Face"} Accessible Room`;
        if (faceIcon) {
            faceIcon.setAttribute("src", face.user?.profil?.photo || face.imagePath || "/image/icon_face.svg");
        }
    };

    const loadAccessRooms = async ({ reset = false } = {}) => {
        if (reset) {
            accessCursor = null;
            accessableRoomContainer.innerHTML = `
                <div class="row bg-neutral-7 p-2 rounded-10">
                    <div class="col-6">
                        <p class="text-center fw-bold text-neutral-2 mb-0">Room ID</p>
                    </div>
                    <div class="col-6">
                        <p class="text-center fw-bold text-neutral-2 mb-0">Name</p>
                    </div>
                </div>
            `;
        }

        const params = new URLSearchParams();
        if (accessCursor) params.set("cursor", accessCursor);

        const resp = await fetch(`/api/v1/face/u/room/accesable/${faceId}?${params.toString()}`, {
            headers: { Accept: "application/json" },
        });

        const json = await resp.json().catch(() => null);
        if (!resp.ok || !json?.success) {
            if (typeof showToast === "function") {
                showToast({
                    theme: "danger",
                    title: "Failed load access rooms",
                    desc: json?.message || `HTTP ${resp.status}`,
                });
            }
            return;
        }

        const rooms = Array.isArray(json.data?.rooms) ? json.data.rooms : [];

        if (reset && rooms.length === 0) {
            accessableRoomContainer.insertAdjacentHTML(
                "beforeend",
                `<div class="text-center py-3 text-neutral-2">Belum ada room access</div>`
            );
            loadMoreAccessableRoom.style.display = "none";
            return;
        }

        rooms.forEach((room) => {
            accessableRoomContainer.insertAdjacentHTML("beforeend", accessableRoomTemplate(room));
        });

        accessCursor = rooms.length > 0 ? rooms[rooms.length - 1].id : accessCursor;
        loadMoreAccessableRoom.style.display = rooms.length > 0 ? "block" : "none";
    };

    const loadRooms = async ({ reset = false } = {}) => {
        if (reset) {
            roomCursor = null;
            roomContainer.innerHTML = "";
        }

        const params = new URLSearchParams();
        const keyword = (searchValue?.value || "").trim();

        if (keyword) params.set("search", keyword);
        if (buildingId !== "all") params.set("building", buildingId);
        if (roomCursor) params.set("cursor", roomCursor);

        const resp = await fetch(`/api/v1/room/u/list?${params.toString()}`, {
            headers: { Accept: "application/json" },
        });

        const json = await resp.json().catch(() => null);
        if (!resp.ok || !json?.success) {
            if (typeof showToast === "function") {
                showToast({
                    theme: "danger",
                    title: "Failed load room list",
                    desc: json?.message || `HTTP ${resp.status}`,
                });
            }
            return;
        }

        const rooms = Array.isArray(json.data) ? json.data : [];

        if (reset && rooms.length === 0) {
            roomContainer.innerHTML = `<div class="text-center py-4 text-neutral-2">Tidak ada room ditemukan</div>`;
            loadMoreRoomList.style.display = "none";
            return;
        }

        rooms.forEach((room, index) => {
            const no = document.querySelectorAll(".hardware--list-item").length + index + 1;
            roomContainer.insertAdjacentHTML(
                "beforeend",
                roomRequestTemplate({ room, no })
            );
        });

        roomCursor = rooms.length > 0 ? rooms[rooms.length - 1].id : roomCursor;
        loadMoreRoomList.style.display = rooms.length > 0 ? "block" : "none";
    };

    const loadBuildings = async ({ reset = false } = {}) => {
        if (reset) {
            buildingCursor = null;
            buildingContainer.innerHTML = "";
        }

        const params = new URLSearchParams();
        if (buildingCursor) params.set("cursor", buildingCursor);

        const resp = await fetch(`/api/v1/building/u/list?${params.toString()}`, {
            headers: { Accept: "application/json" },
        });

        const json = await resp.json().catch(() => null);
        if (!resp.ok || !json?.success) {
            if (typeof showToast === "function") {
                showToast({
                    theme: "danger",
                    title: "Failed load building list",
                    desc: json?.message || `HTTP ${resp.status}`,
                });
            }
            return;
        }

        const buildings = Array.isArray(json.data) ? json.data : [];

        buildings.forEach((building) => {
            buildingContainer.insertAdjacentHTML("beforeend", buildingDataTemplate(building));
        });

        buildingCursor = buildings.length > 0 ? buildings[buildings.length - 1].id : buildingCursor;
        loadMoreBuildingList.style.display = buildings.length > 0 ? "block" : "none";
    };

    const requestRoom = async (roomId) => {
        const roomRow = document.querySelector(`#room-${roomId}`);
        const ruid = roomRow?.getAttribute("data-ruid");

        if (!ruid) return;

        try {
            const resp = await fetch("/api/v1/face/u/request", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    faceId,
                    ruid,
                }),
            });

            const json = await resp.json().catch(() => null);

            if (!resp.ok || !json?.success) {
                if (typeof showToast === "function") {
                    showToast({
                        theme: "danger",
                        title: "Failed request room",
                        desc: json?.message || `HTTP ${resp.status}`,
                    });
                }
                return;
            }

            if (typeof showToast === "function") {
                showToast({
                    theme: "success",
                    title: "Success",
                    desc: "Request access room berhasil dikirim",
                });
            }
        } catch (error) {
            if (typeof showToast === "function") {
                showToast({
                    theme: "danger",
                    title: "Failed request room",
                    desc: error.message || "Network error",
                });
            }
        }
    };

    window.requestRoom = requestRoom;

    window.buildingSelectorHandler = (id) => {
        searchValue.value = "";
        document.querySelectorAll(".building-list-item").forEach((el) => {
            el.classList.remove("bg-blue-4");
            el.classList.add("bg-blue-3");
        });

        const selected = document.getElementById(`building-${id}`);
        if (selected) {
            selected.classList.remove("bg-blue-3");
            selected.classList.add("bg-blue-4");
        }

        buildingId = id;
        roomContainer.innerHTML = "";
        loadRooms({ reset: true });
    };

    searchBtn?.addEventListener("click", () => {
        roomContainer.innerHTML = "";
        roomCursor = null;
        loadRooms({ reset: true });
    });

    loadMoreRoomList?.addEventListener("click", () => loadRooms());
    loadMoreBuildingList?.addEventListener("click", () => loadBuildings());
    loadMoreAccessableRoom?.addEventListener("click", () => loadAccessRooms());

    setHeader();
    loadAccessRooms({ reset: true });
    loadRooms({ reset: true });
    loadBuildings({ reset: true });
});