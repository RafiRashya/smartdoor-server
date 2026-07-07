document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("form");
    const btn = document.querySelector("#save");
    const pinMatchContainer = document.querySelector("#is-new-pin-match");
    const faceId = form.getAttribute("data-face-id");
    const userId = form.getAttribute("data-user-id");

    form.confirmPin.addEventListener("keyup", () => {
        const newPin = form.newPin.value;
        const confirmNewPin = form.confirmPin.value;

        if (newPin !== confirmNewPin) {
            pinMatchContainer.textContent = "New PIN Doesn't Match";
            btn.disabled = true;
        } else if (newPin.length < 4) {
            pinMatchContainer.textContent = "PIN must be at least 4 digits";
            btn.disabled = true;
        } else {
            pinMatchContainer.textContent = " ";
            btn.disabled = false;
        }
    });

    btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const newPin = form.newPin.value;
        const confirmNewPin = form.confirmPin.value;

        btn.disabled = true;

        try {
            const resp = await fetch(`/api/v1/user/${userId}/admin-change-pin`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ newPin, confirmNewPin }),
            });

            const json = await resp.json().catch(() => null);

            if (resp.ok && json?.success) {
                showToast({ theme: "success", title: "Success", desc: "Successfully Changed PIN" });
                setTimeout(() => {
                    window.location = `/dashboard/face-access/detail/${faceId}`;
                }, 2000);
            } else {
                showToast({ theme: "danger", title: "Failed", desc: json?.message || "Failed to change PIN" });
                btn.disabled = false;
            }
        } catch (err) {
            showToast({ theme: "danger", title: "Error", desc: err.message || "Network error" });
            btn.disabled = false;
        }
    });
});
