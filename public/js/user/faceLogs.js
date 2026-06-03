document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("form");
    const faceIdContainer = document.querySelector(".face-id");
    const faceId = faceIdContainer?.getAttribute("data-face");
    const faceIcon = document.querySelector(".face-icon");
    const faceLogs = document.querySelector(".log-container");
    const saveBtn = document.querySelector("#save-change");
    const loadMoreBtn = document.querySelector("#load-more");
    const authTypeForm = document.querySelector("#auth-type");
    const formFaceName = form?.faceName;

    if (!faceId || !faceLogs || !saveBtn) return;

    const escapeHtml = (value) => {
        if (value === null || value === undefined) return "";
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    };

    const days = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const logsTemplate = ({ createdAt, name, number, id, status }) => {
        return `
        <div class="log-info row p-2" data-cursor="${escapeHtml(id)}">
            <div class="col-3">
                <p class="fw-bold text-neutral-2">${number}</p>
            </div>
            <div class="col-3">
                <p class="fw-bold text-neutral-2">${escapeHtml(name)}</p>
            </div>
            <div class="col-3">
                <p class="fw-bold text-neutral-2">${days(createdAt)} WIB</p>
            </div>
            <div class="col-3">
                <p class="fw-bold text-neutral-2 ${status === "Success" ? "text-success" : "text-danger"}">${status}</p>
            </div>
        </div>
        `;
    };

    let cursor = null;

    const loadDetail = async () => {
        try {
            const resp = await fetch(`/api/v1/face/u/${faceId}`, {
                headers: {
                    Accept: "application/json",
                },
            });

            const json = await resp.json().catch(() => null);

            if (!resp.ok || !json?.success) {
                if (typeof showToast === "function") {
                    showToast({
                        theme: "danger",
                        title: "Failed load face detail",
                        desc: json?.message || `HTTP ${resp.status}`,
                    });
                }
                return;
            }

            const face = json.data || {};
            const primaryCard = face.primaryCard || null;

            const faceName = face.label || face.user?.username || "Face";
            faceIdContainer.textContent = `${faceName} details`;

            const faceIdInput = document.querySelector("#face-id-input");
            if (faceIdInput) faceIdInput.value = face.id || faceId;

            if (formFaceName) {
                formFaceName.value = face.label || "";
            }

            if (authTypeForm) {
                authTypeForm.checked = face.status === "ACTIVE";
            }

            const image = face.user?.profil?.photo || face.imagePath || "/image/illustration-user.png";
            if (faceIcon) {
                faceIcon.setAttribute("src", image);
            }

            const uid = document.querySelector("#uid");
            if (uid) {
                uid.textContent = face.user?.username || primaryCard?.card_number || "-";
            }
        } catch (error) {
            if (typeof showToast === "function") {
                showToast({
                    theme: "danger",
                    title: "Error",
                    desc: error.message || "Network error",
                });
            }
        }
    };

    const loadLogs = async ({ reset = false } = {}) => {
        try {
            if (reset) {
                cursor = null;
                faceLogs.innerHTML = "";
            }

            const params = new URLSearchParams();
            if (cursor) params.set("cursor", cursor);

            const resp = await fetch(`/api/v1/face/u/logs/${faceId}?${params.toString()}`, {
                headers: {
                    Accept: "application/json",
                },
            });

            const json = await resp.json().catch(() => null);

            if (!resp.ok || !json?.success) {
                if (typeof showToast === "function") {
                    showToast({
                        theme: "danger",
                        title: "Failed load history",
                        desc: json?.message || `HTTP ${resp.status}`,
                    });
                }
                return;
            }

            const data = Array.isArray(json.data) ? json.data : [];

            if (reset && data.length === 0) {
                faceLogs.innerHTML = `<div class="text-center py-4 text-neutral-2">Belum ada history</div>`;
                loadMoreBtn.style.display = "none";
                return;
            }

            if (!reset && data.length === 0) {
                loadMoreBtn.style.display = "none";
                if (typeof showToast === "function") {
                    showToast({
                        theme: "warning",
                        title: "Data already load",
                        desc: "You have loaded all the data",
                    });
                }
                return;
            }

            let number = document.querySelectorAll(".log-info").length + 1;
            data.forEach((log) => {
                const status = log.isSuccess ? "Success" : "Failed";
                faceLogs.insertAdjacentHTML(
                    "beforeend",
                    logsTemplate({
                        createdAt: log.createdAt,
                        name: log.room?.name || "-",
                        id: log.id,
                        number,
                        status,
                    })
                );
                number += 1;
            });

            cursor = data.length > 0 ? data[data.length - 1].id : cursor;
            loadMoreBtn.style.display = data.length > 0 ? "block" : "none";
        } catch (error) {
            if (typeof showToast === "function") {
                showToast({
                    theme: "danger",
                    title: "Error",
                    desc: error.message || "Network error",
                });
            }
        }
    };

    loadMoreBtn?.addEventListener("click", () => {
        loadLogs();
    });

    saveBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        try {
            const payload = {
                label: formFaceName?.value || "",
                status: authTypeForm?.checked ? "ACTIVE" : "INACTIVE",
            };

            const resp = await fetch(`/api/v1/face/u/${faceId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(payload),
            });

            const json = await resp.json().catch(() => null);

            if (!resp.ok || !json?.success) {
                if (typeof showToast === "function") {
                    showToast({
                        theme: "danger",
                        title: "Failed save",
                        desc: json?.message || `HTTP ${resp.status}`,
                    });
                }
                return;
            }

            if (typeof showToast === "function") {
                showToast({
                    theme: "success",
                    title: "Success",
                    desc: "Data wajah berhasil diupdate",
                });
            }

            loadDetail();
        } catch (error) {
            if (typeof showToast === "function") {
                showToast({
                    theme: "danger",
                    title: "Error",
                    desc: error.message || "Network error",
                });
            }
        }
    });

    loadDetail();
    loadLogs({ reset: true });
});