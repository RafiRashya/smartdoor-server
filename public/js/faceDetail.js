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
    const requireCardToggle = document.getElementById("requireCardToggle");
    const requirePinToggle = document.getElementById("requirePinToggle");
    const mfaNoUserHint = document.getElementById("mfa-no-user-hint");
    const changePinBtn = document.getElementById("changePinBtn");

    let currentUserId = null;

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

            // logs: placeholder
            logContainer.innerHTML = `<div class="text-center py-4 text-neutral-2">No logs available</div>`;

            // MFA preference — hanya aktif jika face sudah terhubung ke user
            currentUserId = f.userId || null;
            if (currentUserId) {
                // Ambil data user untuk mendapatkan requireCard & requirePin terkini
                await loadMfaPreference(currentUserId);
                requireCardToggle.disabled = false;
                requirePinToggle.disabled = false;
                if (mfaNoUserHint) mfaNoUserHint.style.display = "none";
                if (changePinBtn) {
                    changePinBtn.href = `/dashboard/face-access/change-pin/${id}`;
                    changePinBtn.style.display = "inline-block";
                }
            } else {
                requireCardToggle.checked = false;
                requireCardToggle.disabled = true;
                requirePinToggle.checked = false;
                requirePinToggle.disabled = true;
                if (mfaNoUserHint) mfaNoUserHint.style.display = "block";
                if (changePinBtn) {
                    changePinBtn.style.display = "none";
                }
            }
        } catch (err) {
            showToast({ theme: "danger", title: "Error", desc: err.message || "Network error" });
        }
    };


    const loadMfaPreference = async (userId) => {
        try {
            const resp = await fetch(`/api/v1/user/detail/${userId}`);
            if (!resp.ok) return;
            const u = await resp.json().catch(() => null);
            if (u && typeof u === "object") {
                // endpoint /detail/:id returns user object directly (not wrapped in {success, data})
                requireCardToggle.checked = !!u.requireCard;
                requirePinToggle.checked = !!u.requirePin;
            }
        } catch (err) {
            // Non-critical: keep toggles at default false
            console.warn("Failed to load MFA preference:", err.message);
        }
    };

    saveBtn.addEventListener("click", async () => {
        try {
            saveBtn.disabled = true;

            // 1. Save face label & status
            const facePayload = {
                label: labelInput.value || null,
                status: statusSelect.value || undefined,
            };
            const faceResp = await fetch(`/api/v1/face/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(facePayload),
            });
            const faceJson = await faceResp.json().catch(() => null);
            if (!faceResp.ok || !faceJson?.success) {
                showToast({ theme: "danger", title: "Failed save face", desc: faceJson?.message || `HTTP ${faceResp.status}` });
                saveBtn.disabled = false;
                return;
            }

            // 2. Save MFA preference if face is linked to a user
            if (currentUserId) {
                const mfaPayload = {
                    requireCard: requireCardToggle.checked,
                    requirePin: requirePinToggle.checked,
                };
                const mfaResp = await fetch(`/api/v1/user/${currentUserId}/mfa-preference`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(mfaPayload),
                });
                const mfaJson = await mfaResp.json().catch(() => null);
                if (!mfaResp.ok || !mfaJson?.success) {
                    showToast({ theme: "warning", title: "Face saved, MFA gagal", desc: mfaJson?.message || `HTTP ${mfaResp.status}` });
                    saveBtn.disabled = false;
                    return;
                }
            }

            showToast({ theme: "success", title: "Saved", desc: "Face dan preferensi MFA berhasil disimpan" });
            await loadDetail();
            saveBtn.disabled = false;
        } catch (err) {
            showToast({ theme: "danger", title: "Error", desc: err.message || "Network error" });
            saveBtn.disabled = false;
        }
    });

    loadDetail();
});