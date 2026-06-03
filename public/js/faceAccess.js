document.addEventListener("DOMContentLoaded", () => {
    const showMoreBtn = document.querySelector("#show-more");
    const searchInput = document.querySelector("#search");
    const searchBtn = document.querySelector("#search-btn");
    const dataContainer = document.querySelector(".data-container");
    const faceStatus = document.querySelectorAll(".card-status");

    let viewState = "PENDING";
    let limit = 5;

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

    const getStatusLabel = (status) => {
        if (status === "ACTIVE") return "ACTIVE";
        return "PENDING";
    };

    const faceTemplate = (face) => {
        const statusLabel = getStatusLabel(face.status);
        const pairedUser = face.user?.username || face.user?.profil?.full_name || "-";
        const roomCount = Array.isArray(face.roomIds) ? face.roomIds.length : (face.roomAccess?.length || 0);

        const actionContent = `
            <div class="table-data d-flex justify-content-center">
                <p class="hover-tool" data-hover="Delete Face" onclick="deleteHandler('${face.id}', '${face.label || face.id}')">
                    <img src="/image/icon_delete.svg" alt="Delete" class="image pointer me-2">
                </p>
                <a class="hover-tool" data-hover="Detail Face" href="/dashboard/face-access/detail/${face.id}">
                    <img src="/image/icon_info.svg" alt="Info" class="image pointer">
                </a>
            </div>
        `;

        const pairStatusContent = face.status === "ACTIVE" ? "Paired" : "Pair to User";
        const pairStatusClass = face.status === "ACTIVE" ? "text-blue-3" : "text-primary";

        return `
            <div class="table-row d-flex py-2 py-md-2 justify-content-between px-3 card--list-item align-items-center"
                id="action-${face.id}" data-id="${face.id}" data-status="${statusLabel}">

                <span class="table-data text-center text-neutral-2">
                    ${face.label || face.id}
                    <br>
                    <small>${pairedUser}</small>
                </span>

                <p class="table-data text-center text-neutral-2">
                    ${formatDate(face.createdAt)} WIB
                </p>

                <p class="table-data text-center text-neutral-2">
                    ${statusLabel}
                    <br>
                    <small>${roomCount} room</small>
                </p>

                ${actionContent}

                <p class="table-data pointer text-center ${pairStatusClass}"
                    onclick="toggleFaceHandler('${face.id}', '${face.status}')">
                    ${pairStatusContent}
                </p>
            </div>
        `;
    };

    const deleteHandler = (faceId, faceName) => {
        showAlertConfirm({
            theme: "danger",
            title: "Sure for delete?",
            desc: `Are you sure you want to delete this face ${faceName || faceId}`,
            link: "#",
            btn: "Delete",
            exec: async () => {
                try {
                    const resp = await fetch(`/api/v1/face/${faceId}`, {
                        method: "DELETE",
                    });

                    const data = await resp.json().catch(() => null);

                    if (!resp.ok || !data?.success) {
                        showToast({
                            theme: "danger",
                            title: "Failed delete face",
                            desc: data?.message || `Failed to delete face (${resp.status})`,
                        });
                        return;
                    }

                    document.querySelector(`#action-${faceId}`)?.remove();
                    showToast({
                        theme: "success",
                        title: "Success delete face",
                        desc: "Face deleted successfully",
                    });
                } catch (error) {
                    showToast({
                        theme: "danger",
                        title: "Failed delete face",
                        desc: error.message || "Network error",
                    });
                }
            },
        });
    };

    window.deleteHandler = deleteHandler;

    const toggleFaceHandler = (faceId, currentStatus) => {
        if (currentStatus === "PENDING") {
            window.location.href = `/dashboard/face-access/pair/${faceId}`;
        } else {
            showToast({
                theme: "success",
                title: "Face already paired",
                desc: "Open detail page to review access or update face settings.",
            });
        }
    };

    window.toggleFaceHandler = toggleFaceHandler;

    const loadFaces = async () => {
        try {
            const keyword = (searchInput?.value || "").trim();
            const params = new URLSearchParams();

            params.set("limit", String(limit));
            params.set("status", viewState);

            if (keyword.length > 0) {
                params.set("search", keyword);
            }

            const resp = await fetch(`/api/v1/face?${params.toString()}`, {
                headers: {
                    "Content-Type": "application/json",
                },
            });

            const data = await resp.json();

            if (!resp.ok || !data.success) {
                dataContainer.innerHTML = `
                    <div class="text-center py-4 text-neutral-2">
                        Failed load face list
                    </div>
                `;
                showToast({
                    theme: "danger",
                    title: "Failed load face list",
                    desc: data?.message || `HTTP ${resp.status}`,
                });
                return;
            }

            const faces = Array.isArray(data.data) ? data.data : [];
            dataContainer.innerHTML = "";

            if (!faces.length) {
                dataContainer.innerHTML = `
                    <div class="text-center py-4 text-neutral-2">
                        Face list kosong
                    </div>
                `;
                return;
            }

            faces.forEach((face) => {
                dataContainer.insertAdjacentHTML("beforeend", faceTemplate(face));
            });
        } catch (error) {
            dataContainer.innerHTML = `
                <div class="text-center py-4 text-neutral-2">
                    Failed load face list
                </div>
            `;
            showToast({
                theme: "danger",
                title: "Failed load face list",
                desc: error.message || "Network error",
            });
        }
    };

    faceStatus.forEach((status) => {
        status.addEventListener("click", () => {
            faceStatus.forEach((item) => item.classList.remove("card-active"));
            status.classList.add("card-active");

            viewState = status.getAttribute("data-status") || "PENDING";
            limit = 5;

            loadFaces();
        });
    });

    searchBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        limit = 5;
        loadFaces();
    });

    searchInput?.addEventListener("keyup", () => {
        loadFaces();
    });

    showMoreBtn?.addEventListener("click", () => {
        limit += 5;
        loadFaces();
    });

    loadFaces();

    if (typeof showFlashToast === "function") {
        showFlashToast();
    }
});