document.addEventListener("DOMContentLoaded", () => {
    const faceIdInput = document.getElementById("faceId");
    const labelInput = document.getElementById("labelInput");
    const faceUser = document.getElementById("faceUser");
    const faceCreatedAt = document.getElementById("faceCreatedAt");
    const statusSelect = document.getElementById("statusSelect");
    const faceImage = document.getElementById("faceImage");
    const faceLabelTitle = document.getElementById("faceLabelTitle");
    const faceSource = document.getElementById("faceSource");
    const roomContainer = document.getElementById("face-room-container");
    const logContainer = document.getElementById("face-log-container");
    const saveBtn = document.getElementById("saveFaceBtn");

    const formatDate = (s) => {
        if (!s) return "-";
        const d = new Date(s);
        return d.toLocaleString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    };

    const getIdFromPath = () => {
        const parts = window.location.pathname.split("/").filter(Boolean);
        return parts[parts.length - 1];
    };

    const id = getIdFromPath();
    if (id) faceIdInput.value = id;

    const loadDetail = async () => {
        try {
            const resp = await fetch(`/api/v1/face/${id}`);
            const json = await resp.json().catch(() => null);
            if (!resp.ok || !json?.success) {
                showToast({ theme: "danger", title: "Failed load face", desc: json?.message || `HTTP ${resp.status}` });
                return;
            }
            const f = json.data || {};
            faceIdInput.value = f.id || id;
            labelInput.value = f.label || "";
            faceUser.value = f.user?.username || f.user?.profil?.full_name || "-";
            faceCreatedAt.value = formatDate(f.createdAt);
            statusSelect.value = f.status || "PENDING";
            faceLabelTitle.textContent = f.label || f.user?.username || "Unknown";
            faceSource.textContent = `Source gateway: ${f.sourceGatewayShortId || "-"}`;

            if (f.imagePath) {
                faceImage.src = f.imagePath.startsWith("/") ? f.imagePath : `/storage/face/${f.imagePath}`;
            }

            // rooms
            const rooms = Array.isArray(f.roomAccess) ? f.roomAccess : [];
            if (!rooms.length) {
                roomContainer.innerHTML = `<div class="text-center py-4 text-neutral-2">No rooms assigned</div>`;
            } else {
                roomContainer.innerHTML = "";
                rooms.forEach((r) => {
                    const roomName = r.room?.name || `Room ${r.roomId}`;
                    const deviceId = r.room?.device?.device_id || "-";
                    const row = document.createElement("div");
                    row.className = "table-row d-flex py-2 py-md-2 justify-content-between align-items-center px-3";
                    row.innerHTML = `
                        <span class="table-data text-center text-neutral-2">${roomName}</span>
                        <span class="table-data text-center text-neutral-2">${deviceId}</span>
                    `;
                    roomContainer.appendChild(row);
                });
            }

            // logs: placeholder (no API in repo for logs). keep default message.
            logContainer.innerHTML = `<div class="text-center py-4 text-neutral-2">No logs available</div>`;
        } catch (err) {
            showToast({ theme: "danger", title: "Error", desc: err.message || "Network error" });
        }
    };

    saveBtn.addEventListener("click", async () => {
        try {
            saveBtn.disabled = true;
            const payload = {
                label: labelInput.value || null,
                status: statusSelect.value || undefined,
            };
            const resp = await fetch(`/api/v1/face/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await resp.json().catch(() => null);
            if (!resp.ok || !json?.success) {
                showToast({ theme: "danger", title: "Failed save", desc: json?.message || `HTTP ${resp.status}` });
                saveBtn.disabled = false;
                return;
            }
            showToast({ theme: "success", title: "Saved", desc: json?.message || "Face updated" });
            await loadDetail();
            saveBtn.disabled = false;
        } catch (err) {
            showToast({ theme: "danger", title: "Error", desc: err.message || "Network error" });
            saveBtn.disabled = false;
        }
    });

    loadDetail();
});