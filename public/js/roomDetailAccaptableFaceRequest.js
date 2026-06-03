const faceRequestBtn = document.querySelector("#face-request-show-more");
const faceRequestContainer = document.querySelector(".face-request-access");

let faceRequestCursor = null;

const faceRequestTemplate = ({ id, face, room, status, createdAt }) => {
    const faceName =
        face?.label ||
        face?.user?.profil?.full_name ||
        face?.user?.username ||
        "Unknown Face";

    const faceImage = face?.imagePath || "/image/illustration-user.png";
    const userName = face?.user?.username || "Not paired";
    const roomName = room?.name || "-";
    const roomRuid = room?.ruid || "-";
    const statusClass =
        status === "APPROVED"
            ? "text-success"
            : status === "DECLINED"
            ? "text-danger"
            : "text-warning";

    return `
    <div class="col-12 mt-3 face-request-item" data-request="${id}" id="face-request-template-${id}">
        <div class="d-flex flex-column flex-sm-row justify-content-between p-2 bg-neutral-7 rounded-5">
            <div class="d-flex align-items-center">
                <img src="${faceImage}" alt="Face" style="width:48px;height:48px;object-fit:cover;border-radius:12px;" class="me-3">
                <div>
                    <p class="text-neutral-2 mb-1">${faceName} @ ${userName}</p>
                    <p class="text-neutral-4 mb-1">Room: ${roomName} (${roomRuid})</p>
                    <p class="text-neutral-4 mb-0">Requested: ${new Date(createdAt).toLocaleString("id-ID")}</p>
                </div>
            </div>

            <div class="d-flex align-items-center mt-2 mt-sm-0">
                <p class="${statusClass} fw-bold mb-0 me-3">${status}</p>
                <p class="text-neutral-1 pointer fw-bold me-3" onclick="approveFaceAccessAction('${id}')">Approve</p>
                <p class="text-neutral-2 pointer" onclick="declineFaceAccessAction('${id}', '${faceName.replaceAll("'", "\\'")}')">Decline</p>
            </div>
        </div>
    </div>
    `;
};

const loadFaceRequests = async ({ reset = false } = {}) => {
    if (!faceRequestContainer) return;

    try {
        if (reset) {
            faceRequestCursor = null;
            faceRequestContainer.innerHTML = "";
        }

        const query = new URLSearchParams();
        if (faceRequestCursor) query.set("cursor", faceRequestCursor);

        const resp = await fetch(`/api/v1/face/request-face/${ruid}?${query.toString()}`, {
            headers: {
                Accept: "application/json",
            },
        });

        const json = await resp.json().catch(() => null);

        if (!resp.ok || !json?.success) {
            if (typeof showToast === "function") {
                showToast({
                    theme: "danger",
                    title: "Failed load face request",
                    desc: json?.message || `HTTP ${resp.status}`,
                });
            }
            return;
        }

        const data = Array.isArray(json.data) ? json.data : [];

        if (reset && data.length === 0) {
            faceRequestContainer.innerHTML = `<div class="text-center py-3 text-neutral-2">No face request found</div>`;
            if (faceRequestBtn) faceRequestBtn.textContent = "";
            return;
        }

        data.forEach((request) => {
            faceRequestContainer.insertAdjacentHTML("beforeend", faceRequestTemplate(request));
        });

        faceRequestCursor = data.length > 0 ? data[data.length - 1].id : faceRequestCursor;
        if (faceRequestBtn) {
            faceRequestBtn.style.display = data.length > 0 ? "block" : "none";
        }
    } catch (error) {
        if (typeof showToast === "function") {
            showToast({
                theme: "danger",
                title: "Failed load face request",
                desc: error.message || "Network error",
            });
        }
    }
};

const syncFaceRequestCounter = () => {
    const counter = document.querySelector("#face-request");
    if (counter) {
        const current = Number(counter.textContent || 0);
        counter.textContent = String(Math.max(0, current - 1));
    }
};

const approveFaceAccessAction = async (requestId) => {
    const resp = await setter({
        url: "/api/v1/room/approve-face-request",
        body: {
            requestId,
        },
        successMsg: "Success approve face request",
    });

    if (resp.success) {
        const row = document.getElementById(`face-request-template-${requestId}`);
        if (row) row.remove();
        syncFaceRequestCounter();
    }
};

const declineFaceRequest = async (requestId) => {
    const resp = await setter({
        url: "/api/v1/room/decline-face-request",
        body: {
            requestId,
        },
        successMsg: "Success decline face request",
    });

    if (resp.success) {
        const row = document.getElementById(`face-request-template-${requestId}`);
        if (row) row.remove();
        syncFaceRequestCounter();
    }
};

const declineFaceAccessAction = (requestId, faceName) => {
    showAlertConfirm({
        theme: "warning",
        title: "Sure for decline?",
        desc: `Are you sure for decline ${faceName} face request`,
        link: "#",
        btn: "Delete",
        exec: () => declineFaceRequest(requestId),
    });
};

window.approveFaceAccessAction = approveFaceAccessAction;
window.declineFaceAccessAction = declineFaceAccessAction;

if (faceRequestBtn) {
    faceRequestBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const cursor = lastCursorFinder(".face-request-item", "request");
        faceRequestCursor = cursor;
        loadFaceRequests();
    });
}

loadFaceRequests({ reset: true });