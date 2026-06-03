// const { list } = require("../../../../smart-door-server-main/api_role/v1/controllers_role");

document.addEventListener("DOMContentLoaded", () => {
    const faceContainer = document.querySelector('#face-list-container, .card--list-container');
    const searchInput = document.querySelector("#cardname");
    const searchBtn = document.querySelector("#search");
    const loadMoreBtn = document.querySelector("#load-more");

    if (!faceContainer) return;

    const escapeHtml = (value) => {
        if (value === null || value === undefined) return "";
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "-";
        const date = new Date(dateStr);
        return date.toLocaleString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const faceTemplate = (face) => {
        const roomCount = Array.isArray(face.roomAccess) ? face.roomAccess.length : 0;
        const userName =
            face.user?.username ||
            face.user?.profil?.full_name ||
            "Unknown User";
        const faceImage = face.imagePath || "/image/illustration-user.png";
        const statusClass =
            face.status === "ACTIVE"
                ? "text-success"
                : face.status === "INACTIVE"
                ? "text-danger"
                : "text-warning";

        return `
        <div class="card--list-item face-item-box mt-3 pe-sm-5 pe-3 d-flex flex-column flex-sm-row align-items-between align-items-sm-center justify-content-between bg-neutral-7 shadow-c-1 p-3 rounded-13" data-cursor="${escapeHtml(face.id)}">
            <div class="icon-box rounded-10 position-relative d-flex justify-content-center align-items-center me-sm-4" style="width: 140px; height: 140px; overflow: hidden; flex-shrink: 0;">
                <span class="position-absolute top-0 start-0 text-white fw-bold m-2" style="font-size: 0.65rem; z-index: 2;">FACE ID</span>
                <img src="${escapeHtml(faceImage)}" alt="Face" style="width: 100%; height: 100%; object-fit: cover;">
            </div>

            <div class="card-profile d-flex flex-column flex-sm-row justify-content-start align-items-start align-items-sm-center flex-grow-1">
                <div class="ms-0 ms-sm-4 mt-3 mt-sm-0">
                    <h5 class="fw-bold text-blue-4 mb-1">${escapeHtml(face.label || userName)}</h5>
                    <p class="text-blue-3 mb-1">${escapeHtml(face.id)}</p>
                    <p class="mb-0 ${statusClass} fw-bold">${escapeHtml(face.status || "-")} | ${roomCount} room</p>
                </div>
            </div>

            <a href="/face/room/${escapeHtml(face.id)}" class="text-blue-3 fw-bold d-flex align-items-center mt-sm-0 mt-2 text-decoration-none">
                <img src="/image/icon_room.svg" alt="" class="room-icons">
                <p class="ms-2 mb-0">Room Settings</p>
            </a>

            <a href="/face/detail/${escapeHtml(face.id)}" class="ms-0 ms-sm-5 me-5 text-blue-3 fw-bold d-flex align-items-center mt-sm-0 mt-2 text-decoration-none">
                <img src="/image/icon_log.svg" alt="" class="room-icons">
                <p class="ms-2 mb-0">History & Face Settings</p>
            </a>
        </div>
        `;
    };

    let cursor = null;
    let currentSearch = "";

    const loadFaces = async ({ reset = false } = {}) => {
        try {
            if (reset) {
                cursor = null;
                faceContainer.innerHTML = "";
            }

            const params = new URLSearchParams();
            if (currentSearch) params.set("search", currentSearch);
            if (cursor) params.set("cursor", cursor);

            const resp = await fetch(`/api/v1/face/u/list?${params.toString()}`, {
                headers: {
                    Accept: "application/json",
                },
            });

            const json = await resp.json().catch(() => null);

            if (!resp.ok || !json?.success) {
                faceContainer.innerHTML = `<div class="text-center py-4 text-neutral-2">Failed load face list</div>`;
                if (typeof showToast === "function") {
                    showToast({
                        theme: "danger",
                        title: "Failed load face list",
                        desc: json?.message || `HTTP ${resp.status}`,
                    });
                }
                return;
            }

            const faces = Array.isArray(json.data) ? json.data : [];

            if (reset && faces.length === 0) {
                faceContainer.innerHTML = `<div class="text-center py-4 text-neutral-2">No face found</div>`;
                loadMoreBtn.style.display = "none";
                return;
            }

            faces.forEach((face) => {
                faceContainer.insertAdjacentHTML("beforeend", faceTemplate(face));
            });

            cursor = faces.length > 0 ? faces[faces.length - 1].id : cursor;
            loadMoreBtn.style.display = faces.length > 0 ? "block" : "none";
        } catch (error) {
            if (typeof showToast === "function") {
                showToast({
                    theme: "danger",
                    title: "Failed load face list",
                    desc: error.message || "Network error",
                });
            }
        }
    };

    searchBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        currentSearch = (searchInput?.value || "").trim();
        loadFaces({ reset: true });
    });

    searchInput?.addEventListener("keyup", () => {
        currentSearch = (searchInput?.value || "").trim();
    });

    loadMoreBtn?.addEventListener("click", () => {
        loadFaces();
    });

    loadFaces({ reset: true });

    if (typeof showFlashToast === "function") {
        showFlashToast();
    }
});