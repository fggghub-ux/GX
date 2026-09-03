(function () {
    const DOWNLOAD_URL_LIFETIME_MS = 5000;
    const READY_OVERLAY_ID = 'u2-export-ready-overlay';

    function isIosStandalone() {
        const userAgent = String(window.navigator?.userAgent || '');
        const isIOS = /iPad|iPhone|iPod/i.test(userAgent)
            || (window.navigator?.platform === 'MacIntel' && Number(window.navigator?.maxTouchPoints) > 1);
        const isStandalone = window.navigator?.standalone === true
            || window.matchMedia?.('(display-mode: standalone)')?.matches === true;
        return isIOS && isStandalone;
    }

    function makeShareFile(blob, fileName) {
        if (typeof window.File !== 'function') return null;
        try {
            return new window.File([blob], fileName, {
                type: blob.type || 'application/octet-stream',
                lastModified: Date.now()
            });
        } catch (error) {
            console.warn('[u2ExportFile] Failed to create share file:', error);
            return null;
        }
    }

    function canShareFile(file) {
        if (!file || typeof window.navigator?.share !== 'function') return false;
        try {
            return typeof window.navigator.canShare !== 'function'
                || window.navigator.canShare({ files: [file] });
        } catch (error) {
            return false;
        }
    }

    async function shareFile(file, title) {
        try {
            await window.navigator.share({
                files: [file],
                title: title || file.name
            });
            return 'shared';
        } catch (error) {
            if (error?.name === 'AbortError') return 'cancelled';
            if (error?.name === 'NotAllowedError') return 'needs-user-action';
            console.warn('[u2ExportFile] System share failed:', error);
            return 'failed';
        }
    }

    function promptForShare(file, title) {
        return new Promise((resolve) => {
            document.getElementById(READY_OVERLAY_ID)?.remove();

            const overlay = document.createElement('div');
            overlay.id = READY_OVERLAY_ID;
            overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.28);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';

            const card = document.createElement('div');
            card.style.cssText = 'width:min(100%,360px);padding:22px;border-radius:18px;background:#fff;color:#1c1c1e;box-shadow:0 18px 50px rgba(0,0,0,.18);text-align:center;';

            const heading = document.createElement('div');
            heading.textContent = '文件已准备好';
            heading.style.cssText = 'font-size:18px;font-weight:700;';

            const detail = document.createElement('div');
            detail.textContent = '点击下方按钮打开系统分享，可选择“存储到文件”。';
            detail.style.cssText = 'margin-top:9px;color:#6e6e73;font-size:14px;line-height:1.5;';

            const shareButton = document.createElement('button');
            shareButton.type = 'button';
            shareButton.textContent = '分享并存储';
            shareButton.style.cssText = 'width:100%;height:44px;margin-top:20px;border:0;border-radius:12px;background:#007aff;color:#fff;font-size:16px;font-weight:600;';

            const cancelButton = document.createElement('button');
            cancelButton.type = 'button';
            cancelButton.textContent = '取消';
            cancelButton.style.cssText = 'width:100%;height:40px;margin-top:8px;border:0;background:transparent;color:#6e6e73;font-size:15px;';

            let settled = false;
            const finish = (result) => {
                if (settled) return;
                settled = true;
                overlay.remove();
                resolve(result);
            };

            shareButton.addEventListener('click', async () => {
                shareButton.disabled = true;
                const result = await shareFile(file, title);
                if (result === 'needs-user-action') {
                    shareButton.disabled = false;
                    detail.textContent = '系统暂时无法打开分享，请再试一次。';
                    return;
                }
                finish(result);
            });
            cancelButton.addEventListener('click', () => finish('cancelled'));
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) finish('cancelled');
            });

            card.append(heading, detail, shareButton, cancelButton);
            overlay.appendChild(card);
            document.body.appendChild(overlay);
        });
    }

    function downloadFile(blob, fileName) {
        try {
            const objectUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = fileName;
            link.hidden = true;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), DOWNLOAD_URL_LIFETIME_MS);
            return 'downloaded';
        } catch (error) {
            console.warn('[u2ExportFile] Browser download failed:', error);
            return 'failed';
        }
    }

    window.u2ExportFile = async function u2ExportFile({ blob, fileName, title = '' } = {}) {
        if (!(blob instanceof window.Blob) || !String(fileName || '').trim()) {
            console.warn('[u2ExportFile] A Blob and fileName are required.');
            return 'failed';
        }

        const safeFileName = String(fileName).trim();
        if (!isIosStandalone()) return downloadFile(blob, safeFileName);

        const shareFileObject = makeShareFile(blob, safeFileName);
        if (!canShareFile(shareFileObject)) {
            console.warn('[u2ExportFile] File sharing is unavailable in this iOS standalone session.');
            return 'failed';
        }

        if (window.navigator.userActivation && !window.navigator.userActivation.isActive) {
            return promptForShare(shareFileObject, title);
        }

        const result = await shareFile(shareFileObject, title);
        return result === 'needs-user-action'
            ? promptForShare(shareFileObject, title)
            : result;
    };
})();
